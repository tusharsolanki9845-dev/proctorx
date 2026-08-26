# Workspace Ponytail Policy Application

## Scope Reviewed

The current workspace inventory found one eligible application project: **ProctorX** at `/home/ubuntu/proctorx`. The Node runtime directory and the isolated third-party Ponytail inspection clone were excluded because they are not eligible application projects.

## Policy Applied

ProctorX now includes `AGENTS.md`, an internally authored development policy that applies a minimal-change decision ladder while retaining security, privacy, accessibility, migration, audit, testing, and deployment safeguards. The policy is inspired only at a conceptual level by the MIT-licensed Ponytail project.[1]

## Runtime Boundary Verified

No Ponytail package, lifecycle hook, plugin, runtime dependency, production network call, Android component, candidate-facing code, or administrator-facing code was installed. The downloaded source remains isolated at `/home/ubuntu/third_party/ponytail` for review and is not part of the deployed ProctorX application.

## References

[1]: https://github.com/DietrichGebert/ponytail "DietrichGebert/ponytail"
