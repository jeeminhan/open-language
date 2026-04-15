# Alongside Feature Setup Guide

This feature adds tables and storage for the `/alongside` route (listen alongside a tutor while audio plays). You need to apply these migrations and configure storage manually.

## Step A: Apply the Database Migration

1. Open your Supabase dashboard
2. Go to **SQL Editor** → **New query**
3. Copy the entire contents of `supabase-alongside.sql`
4. Paste into the query editor
5. Click **Run**

You should see: `CREATE TABLE`, `CREATE INDEX`, `ALTER TABLE`, and `CREATE POLICY` statements complete without errors.

## Step B: Create the Storage Bucket

1. In Supabase dashboard, go to **Storage**
2. Click **New bucket**
3. Name: `media`
4. Make it **Private** (toggle OFF for "Public")
5. Click **Save**

## Step C: Configure Storage RLS Policies

In **Storage** → **media** bucket → **Policies**, add the following rules. You can either:

### Option 1: Use the Dashboard UI
Add three separate policies manually through the dashboard.

### Option 2: Use SQL (Recommended)

Copy and run this SQL in the **SQL Editor**:

```sql
-- Allow authenticated users to manage their own files under alongside/<uid>/
create policy "alongside own uploads"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'alongside'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "alongside own reads"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'alongside'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "alongside own deletes"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = 'alongside'
    and (storage.foldername(name))[2] = auth.uid()::text
  );
```

These policies allow each authenticated user to upload, read, and delete files only in their own `alongside/<user-id>/` folder.

## Step D: Verify

Run this query to confirm all tables were created:

```sql
select table_name from information_schema.tables
where table_name like 'alongside_%'
order by table_name;
```

**Expected result:** Three rows
- `alongside_interactions`
- `alongside_segments`
- `alongside_sessions`

If all three appear, setup is complete!
