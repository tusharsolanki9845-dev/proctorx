# ProctorX Public/Free API Decision

## Selected Default

**Resend** remains the recommended optional transactional-email provider for ProctorX because its documented free plan permits up to **3,000 transactional emails per month** with a **100-email daily limit**. It supports the existing server-side HTTP request pattern through `RESEND_API_KEY` and `RESEND_FROM_EMAIL`. A verified sender is still required for real production delivery. [1]

## Alternative

**Brevo** is a viable public API alternative. Its transactional-email API requires an API key and a registered sender or sending domain, and supports static HTML/text email requests suitable for verification and password-reset links. [2]

## Current Safe Behavior

ProctorX does not send real email without configured credentials. In development it presents an explicit link preview for verification and password-reset flows; in production it returns a configuration-required state. This prevents exposure of security tokens through a public fallback.

## Sources

[1] [Resend pricing documentation](https://resend.com/docs/knowledge-base/what-is-resend-pricing)

[2] [Brevo transactional email API documentation](https://developers.brevo.com/docs/send-a-transactional-email)
