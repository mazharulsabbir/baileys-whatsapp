-- Manual SQL Setup for Test User
-- Run this inside the PostgreSQL database to create a test user with active subscription
--
-- Usage:
--   docker-compose exec db psql -U app app -f /path/to/this/file.sql
--
-- OR connect interactively:
--   docker-compose exec db psql -U app app
--   Then copy-paste the SQL below

-- Step 1: Create test user (if doesn't exist)
-- Note: You'll need to use the registration API to get proper password hash
-- This creates the user record that will be updated by API registration

DO $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Check if user exists
    SELECT id INTO v_user_id FROM "User" WHERE email = 'test@example.com';

    IF v_user_id IS NULL THEN
        -- Create new user (password will be set via API)
        INSERT INTO "User" (id, email, password, "createdAt", "updatedAt")
        VALUES (
            gen_random_uuid(),
            'test@example.com',
            '$2b$10$placeholder', -- Will be overwritten by API registration
            NOW(),
            NOW()
        )
        RETURNING id INTO v_user_id;

        RAISE NOTICE 'Created new user: %', v_user_id;
    ELSE
        RAISE NOTICE 'User already exists: %', v_user_id;
    END IF;

    -- Create or update entitlement
    INSERT INTO "Entitlement" (id, "userId", "planSlug", status, "validUntil", "createdAt", "updatedAt")
    VALUES (
        gen_random_uuid(),
        v_user_id,
        'premium',
        'active',
        NOW() + INTERVAL '30 days',
        NOW(),
        NOW()
    )
    ON CONFLICT ("userId") DO UPDATE SET
        status = 'active',
        "planSlug" = 'premium',
        "validUntil" = NOW() + INTERVAL '30 days',
        "updatedAt" = NOW();

    RAISE NOTICE 'Entitlement created/updated for user';
END $$;

-- Step 2: Verify the setup
SELECT
    u.id AS user_id,
    u.email,
    e."planSlug" AS plan,
    e.status,
    e."validUntil" AS valid_until,
    CASE
        WHEN e.status = 'active' AND e."validUntil" > NOW() THEN '✓ Active'
        ELSE '✗ Inactive'
    END AS subscription_status
FROM "User" u
LEFT JOIN "Entitlement" e ON e."userId" = u.id
WHERE u.email = 'test@example.com';

-- Step 3: Quick reference for other operations

-- Add entitlement for ANY existing user (replace EMAIL):
-- INSERT INTO "Entitlement" ("userId", "planSlug", status, "validUntil", "createdAt", "updatedAt")
-- SELECT id, 'premium', 'active', NOW() + INTERVAL '30 days', NOW(), NOW()
-- FROM "User" WHERE email = 'YOUR_EMAIL_HERE'
-- ON CONFLICT ("userId") DO UPDATE SET
--   status = 'active',
--   "validUntil" = NOW() + INTERVAL '30 days';

-- View all users and their entitlements:
-- SELECT u.id, u.email, e."planSlug", e.status, e."validUntil"
-- FROM "User" u
-- LEFT JOIN "Entitlement" e ON e."userId" = u.id
-- ORDER BY u."createdAt" DESC;

-- Extend entitlement by 30 days:
-- UPDATE "Entitlement"
-- SET "validUntil" = "validUntil" + INTERVAL '30 days',
--     "updatedAt" = NOW()
-- WHERE "userId" = (SELECT id FROM "User" WHERE email = 'test@example.com');

-- Deactivate entitlement:
-- UPDATE "Entitlement"
-- SET status = 'inactive',
--     "updatedAt" = NOW()
-- WHERE "userId" = (SELECT id FROM "User" WHERE email = 'test@example.com');
