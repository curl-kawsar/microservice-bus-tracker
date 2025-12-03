import { Hono } from 'hono';
import bcrypt from 'bcryptjs';
import * as XLSX from 'xlsx';
import User from '../models/User.js';

const router = new Hono();

const DEFAULT_STUDENT_PASSWORD = process.env.DEFAULT_STUDENT_PASSWORD || 'baiustbus123#';

// POST /admin/students/import - Import students from Excel
router.post('/students/import', async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get('file');

    if (!file) {
      return c.json({ error: 'No file uploaded' }, 400);
    }

    // Read the file buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse Excel file
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    if (!data || data.length === 0) {
      return c.json({ error: 'Excel file is empty' }, 400);
    }

    // Validate required columns
    const firstRow = data[0];
    if (!firstRow.studentId && !firstRow.StudentId && !firstRow.student_id) {
      return c.json({ error: 'Excel must have studentId column' }, 400);
    }
    if (!firstRow.name && !firstRow.Name) {
      return c.json({ error: 'Excel must have name column' }, 400);
    }

    // Hash the default password once
    const passwordHash = await bcrypt.hash(DEFAULT_STUDENT_PASSWORD, 10);

    const results = {
      created: 0,
      updated: 0,
      errors: [],
    };

    // Process each row
    for (const row of data) {
      const studentId = row.studentId || row.StudentId || row.student_id;
      const name = row.name || row.Name;

      if (!studentId || !name) {
        results.errors.push(`Row missing studentId or name: ${JSON.stringify(row)}`);
        continue;
      }

      try {
        const existingUser = await User.findOne({ username: studentId.toString() });

        if (existingUser) {
          // Update existing user
          existingUser.name = name.toString();
          await existingUser.save();
          results.updated++;
        } else {
          // Create new user
          const newUser = new User({
            username: studentId.toString(),
            name: name.toString(),
            role: 'STUDENT',
            passwordHash,
          });
          await newUser.save();
          results.created++;
        }
      } catch (err) {
        results.errors.push(`Error processing ${studentId}: ${err.message}`);
      }
    }

    return c.json({
      success: true,
      message: `Import completed. Created: ${results.created}, Updated: ${results.updated}`,
      results,
    });
  } catch (error) {
    console.error('Import error:', error);
    return c.json({ error: 'Failed to import students: ' + error.message }, 500);
  }
});

// GET /admin/students - Get all students
router.get('/students', async (c) => {
  try {
    const students = await User.find({ role: 'STUDENT' }, { passwordHash: 0 });
    return c.json({ students });
  } catch (error) {
    console.error('Get students error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// DELETE /admin/students/:id - Delete a student
router.delete('/students/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const result = await User.findByIdAndDelete(id);

    if (!result) {
      return c.json({ error: 'Student not found' }, 404);
    }

    return c.json({ success: true, message: 'Student deleted' });
  } catch (error) {
    console.error('Delete student error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default router;
