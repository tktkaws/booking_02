| table_name      | column_name     | data_type                | is_nullable | column_default    |
| --------------- | --------------- | ------------------------ | ----------- | ----------------- |
| bookings        | id              | bigint                   | NO          | null              |
| bookings        | title           | text                     | NO          | null              |
| bookings        | description     | text                     | NO          | ''::text          |
| bookings        | start_at        | timestamp with time zone | NO          | null              |
| bookings        | end_at          | timestamp with time zone | NO          | null              |
| bookings        | created_by      | uuid                     | NO          | null              |
| bookings        | created_at      | timestamp with time zone | NO          | now()             |
| bookings        | updated_at      | timestamp with time zone | NO          | now()             |
| bookings        | is_companywide  | boolean                  | NO          | false             |
| departments     | id              | uuid                     | NO          | gen_random_uuid() |
| departments     | name            | text                     | NO          | null              |
| departments     | default_color   | text                     | NO          | '#64748b'::text   |
| departments     | created_at      | timestamp with time zone | NO          | now()             |
| departments     | updated_at      | timestamp with time zone | NO          | now()             |
| profiles        | id              | uuid                     | NO          | null              |
| profiles        | display_name    | text                     | NO          | null              |
| profiles        | department_id   | uuid                     | NO          | null              |
| profiles        | color_settings  | jsonb                    | NO          | '{}'::jsonb       |
| profiles        | is_admin        | boolean                  | NO          | false             |
| profiles        | deleted_at      | timestamp with time zone | YES         | null              |
| profiles        | created_at      | timestamp with time zone | NO          | now()             |
| profiles        | updated_at      | timestamp with time zone | NO          | now()             |
| profiles_public | id              | uuid                     | YES         | null              |
| profiles_public | display_name    | text                     | YES         | null              |
| profiles_public | department_id   | uuid                     | YES         | null              |
| profiles_public | department_name | text                     | YES         | null              |
| profiles_public | color_settings  | jsonb                    | YES         | null              |
| settings        | company_color   | text                     | YES         | null              |
