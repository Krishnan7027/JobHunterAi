# Auth Module Spec

## Purpose
User registration and authentication via JWT.

## Endpoints
- `POST /api/auth/register` — Create account
- `POST /api/auth/login` — Get JWT token

## Inputs
- Register: username (3-50 chars), email, password (8+ chars)
- Login: username, password

## Outputs
- AuthResponse: { access_token, token_type, user_id, username }

## Dependencies
- core.security (password hashing, JWT creation)
- core.models.User

## Rules
- Username and email must be unique (409 on conflict)
- Passwords never stored in plain text
- JWT contains user_id in `sub` claim
