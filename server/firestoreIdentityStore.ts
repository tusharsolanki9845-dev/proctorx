import { createHash } from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import type { InsertUser } from "../drizzle/schema";
import { getFirebaseFirestore } from "./firebaseAdmin";

type Role = "user" | "admin";
type TokenPurpose = "verify_email" | "reset_password";

type StoredUser = {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  emailVerifiedAt: Timestamp | null;
  loginMethod: string | null;
  role: Role;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastSignedIn: Timestamp;
  profile?: { fullName: string; collegeName: string | null; rollNumber: string | null };
  passwordHash?: string;
};

function lookupId(value: string) {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

function asDate(value: Timestamp | Date | null | undefined) {
  if (!value) return null;
  return value instanceof Timestamp ? value.toDate() : value;
}

function presentUser(record: StoredUser) {
  return {
    id: record.id,
    openId: record.openId,
    name: record.name,
    email: record.email,
    emailVerifiedAt: asDate(record.emailVerifiedAt),
    loginMethod: record.loginMethod,
    role: record.role,
    createdAt: asDate(record.createdAt)!,
    updatedAt: asDate(record.updatedAt)!,
    lastSignedIn: asDate(record.lastSignedIn)!,
  };
}

async function nextIdInTransaction(entity: string, transaction: FirebaseFirestore.Transaction) {
  const db = getFirebaseFirestore();
  const counter = db.collection("meta").doc("counters");
  const current = await transaction.get(counter);
  const next = Number(current.data()?.[entity] ?? 0) + 1;
  transaction.set(counter, { [entity]: next }, { merge: true });
  return next;
}

async function nextId(entity: string) {
  const db = getFirebaseFirestore();
  return db.runTransaction(transaction => nextIdInTransaction(entity, transaction));
}

export async function upsertUser(input: InsertUser) {
  if (!input.openId) throw new Error("User openId is required for upsert");
  const db = getFirebaseFirestore();
  const lookup = db.collection("userLookup").doc("openId").collection("entries").doc(lookupId(input.openId));
  const now = Timestamp.now();

  await db.runTransaction(async transaction => {
    const existingLookup = await transaction.get(lookup);
    const id = existingLookup.exists ? Number(existingLookup.data()!.userId) : await nextIdInTransaction("users", transaction);
    const userRef = db.collection("users").doc(String(id));
    const prior = await transaction.get(userRef);
    const priorData = prior.exists ? (prior.data() as StoredUser) : undefined;
    const record: Partial<StoredUser> = {
      id,
      openId: input.openId,
      name: input.name ?? priorData?.name ?? null,
      email: input.email ?? priorData?.email ?? null,
      loginMethod: input.loginMethod ?? priorData?.loginMethod ?? null,
      role: (input.role as Role | undefined) ?? priorData?.role ?? "user",
      lastSignedIn: Timestamp.fromDate(input.lastSignedIn ?? new Date()),
      updatedAt: now,
    };
    if (!prior.exists) {
      record.createdAt = now;
      record.emailVerifiedAt = null;
    }
    transaction.set(userRef, record, { merge: true });
    transaction.set(lookup, { userId: id });
    if (record.email) {
      transaction.set(db.collection("userLookup").doc("email").collection("entries").doc(lookupId(record.email)), { userId: id });
    }
  });
}

export async function getUserByOpenId(openId: string) {
  const db = getFirebaseFirestore();
  const lookup = await db.collection("userLookup").doc("openId").collection("entries").doc(lookupId(openId)).get();
  if (!lookup.exists) return undefined;
  const record = await db.collection("users").doc(String(lookup.data()!.userId)).get();
  return record.exists ? presentUser(record.data() as StoredUser) : undefined;
}

export async function getUserById(userId: number) {
  const record = await getFirebaseFirestore().collection("users").doc(String(userId)).get();
  return record.exists ? presentUser(record.data() as StoredUser) : null;
}

export async function getStudentProfile(userId: number) {
  const record = await getFirebaseFirestore().collection("users").doc(String(userId)).get();
  if (!record.exists) return null;
  const user = record.data() as StoredUser;
  if (!user.profile) return null;
  return { id: userId, userId, ...user.profile, createdAt: asDate(user.createdAt)!, updatedAt: asDate(user.updatedAt)! };
}

export async function upsertStudentProfile(input: { userId: number; fullName: string; collegeName?: string | null; rollNumber?: string | null }) {
  const db = getFirebaseFirestore();
  await db.collection("users").doc(String(input.userId)).set(
    {
      profile: { fullName: input.fullName, collegeName: input.collegeName ?? null, rollNumber: input.rollNumber ?? null },
      updatedAt: Timestamp.now(),
    },
    { merge: true }
  );
  return getStudentProfile(input.userId);
}

export async function createLocalStudent(input: {
  openId: string;
  fullName: string;
  email: string;
  collegeName?: string | null;
  rollNumber?: string | null;
  passwordHash: string;
}) {
  const db = getFirebaseFirestore();
  const emailLookup = db.collection("userLookup").doc("email").collection("entries").doc(lookupId(input.email));
  const openIdLookup = db.collection("userLookup").doc("openId").collection("entries").doc(lookupId(input.openId));

  return db.runTransaction(async transaction => {
    const existing = await transaction.get(emailLookup);
    if (existing.exists) throw new Error("An account already exists for this email address.");
    const id = await nextIdInTransaction("users", transaction);
    const now = Timestamp.now();
    const record: StoredUser = {
      id,
      openId: input.openId,
      name: input.fullName,
      email: input.email,
      emailVerifiedAt: null,
      loginMethod: "local",
      role: "user",
      createdAt: now,
      updatedAt: now,
      lastSignedIn: now,
      profile: { fullName: input.fullName, collegeName: input.collegeName ?? null, rollNumber: input.rollNumber ?? null },
      passwordHash: input.passwordHash,
    };
    transaction.create(db.collection("users").doc(String(id)), record);
    transaction.create(emailLookup, { userId: id });
    transaction.create(openIdLookup, { userId: id });
    return { id };
  });
}

export async function findLocalCredentialByEmail(email: string) {
  const db = getFirebaseFirestore();
  const lookup = await db.collection("userLookup").doc("email").collection("entries").doc(lookupId(email)).get();
  if (!lookup.exists) return null;
  const user = await db.collection("users").doc(String(lookup.data()!.userId)).get();
  if (!user.exists) return null;
  const data = user.data() as StoredUser;
  if (!data.passwordHash) return null;
  return { userId: data.id, passwordHash: data.passwordHash, role: data.role, email: data.email, name: data.name, emailVerifiedAt: asDate(data.emailVerifiedAt) };
}

export async function findLocalAccountByEmail(email: string) {
  const user = await findLocalCredentialByEmail(email);
  return user ? { userId: user.userId, email: user.email, emailVerifiedAt: user.emailVerifiedAt, fullName: user.name } : null;
}

export async function createAccountToken(userId: number, purpose: TokenPurpose, tokenHash: string, expiresAt: Date) {
  const db = getFirebaseFirestore();
  await db.collection("accountTokens").doc(tokenHash).create({ userId, purpose, tokenHash, expiresAt: Timestamp.fromDate(expiresAt), consumedAt: null, createdAt: Timestamp.now() });
  return { id: tokenHash };
}

export async function consumeAccountToken(tokenHash: string, purpose: TokenPurpose) {
  const db = getFirebaseFirestore();
  const ref = db.collection("accountTokens").doc(tokenHash);
  return db.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return null;
    const token = snapshot.data() as { userId: number; purpose: TokenPurpose; expiresAt: Timestamp; consumedAt: Timestamp | null };
    if (token.purpose !== purpose || token.consumedAt || token.expiresAt.toDate() <= new Date()) return null;
    transaction.update(ref, { consumedAt: Timestamp.now() });
    return { id: tokenHash, userId: token.userId, purpose: token.purpose, expiresAt: token.expiresAt.toDate(), consumedAt: null };
  });
}

export async function markEmailVerified(userId: number) {
  await getFirebaseFirestore().collection("users").doc(String(userId)).set({ emailVerifiedAt: Timestamp.now(), updatedAt: Timestamp.now() }, { merge: true });
}

export async function replaceLocalPassword(userId: number, passwordHash: string) {
  await getFirebaseFirestore().collection("users").doc(String(userId)).set({ passwordHash, updatedAt: Timestamp.now() }, { merge: true });
}

export async function touchUserSignIn(userId: number) {
  await getFirebaseFirestore().collection("users").doc(String(userId)).set({ lastSignedIn: Timestamp.now(), updatedAt: Timestamp.now() }, { merge: true });
}

export async function ensureConfiguredAdmin(openId: string) {
  const existing = await getUserByOpenId(openId);
  if (existing) {
    await getFirebaseFirestore().collection("users").doc(String(existing.id)).set({ role: "admin", loginMethod: "configured-admin", lastSignedIn: Timestamp.now(), updatedAt: Timestamp.now() }, { merge: true });
    return (await getUserById(existing.id))!;
  }
  const id = await nextId("users");
  const now = Timestamp.now();
  await getFirebaseFirestore().collection("users").doc(String(id)).create({ id, openId, name: "ProctorX Administrator", email: null, emailVerifiedAt: null, loginMethod: "configured-admin", role: "admin", createdAt: now, updatedAt: now, lastSignedIn: now } satisfies StoredUser);
  await getFirebaseFirestore().collection("userLookup").doc("openId").collection("entries").doc(lookupId(openId)).set({ userId: id });
  return (await getUserById(id))!;
}

export async function listManagedUsers() {
  const snapshot = await getFirebaseFirestore().collection("users").orderBy("createdAt", "desc").get();
  return snapshot.docs.map(document => {
    const data = document.data() as StoredUser;
    return { ...presentUser(data), fullName: data.profile?.fullName ?? null, collegeName: data.profile?.collegeName ?? null, rollNumber: data.profile?.rollNumber ?? null };
  });
}

export async function updateManagedUser(actorUserId: number, input: { userId: number; fullName: string; collegeName?: string | null; rollNumber?: string | null; role: Role }) {
  const db = getFirebaseFirestore();
  const ref = db.collection("users").doc(String(input.userId));
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new Error("User record was not found.");
  await ref.set({ name: input.fullName, role: input.role, profile: { fullName: input.fullName, collegeName: input.collegeName ?? null, rollNumber: input.rollNumber ?? null }, updatedAt: Timestamp.now() }, { merge: true });
  await db.collection("auditLogs").add({ actorUserId, action: "identity.updated", entityType: "user", entityId: input.userId, metadata: { role: input.role }, createdAt: Timestamp.now() });
  return getUserById(input.userId);
}

export const __private__ = { lookupId, nextId };
