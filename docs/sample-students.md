# Student Import Excel Format

## Required Columns

The Excel file (.xlsx) for importing students must have these columns:

| Column Name | Description | Example |
|-------------|-------------|---------|
| `studentId` | Unique student identifier (becomes username) | STU001 |
| `name` | Student's full name | John Doe |

## Column Name Variations

The system accepts these variations:
- `studentId`, `StudentId`, or `student_id`
- `name` or `Name`

## Example Excel Content

| studentId | name |
|-----------|------|
| STU001 | John Doe |
| STU002 | Jane Smith |
| STU003 | Bob Johnson |
| 2024001 | Alice Brown |
| 2024002 | Charlie Wilson |

## Import Behavior

1. **New Students**: Created with default password `baiustbus123#`
2. **Existing Students**: Name is updated, password remains unchanged
3. **Role**: All imported users receive `STUDENT` role

## After Import

- Students log in with their `studentId` as username
- Default password: `baiustbus123#`
- Admin can assign buses to students from the Students page
