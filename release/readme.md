# Release Email System

## Setup

1. Install dependencies:
   npm install nodemailer

2. Update config.json:
   - Add recipient emails
   - Update download URL
   - Update release notes

3. Update credentials in send-email.js

## Run

node release/send.js

## Notes

- Uses HTML email template
- Supports multiple recipients
- Designed for internal release announcements