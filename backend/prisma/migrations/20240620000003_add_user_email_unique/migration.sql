-- Add unique constraint on users.email
ALTER TABLE "users" ADD CONSTRAINT "users_email_key" UNIQUE ("email");
