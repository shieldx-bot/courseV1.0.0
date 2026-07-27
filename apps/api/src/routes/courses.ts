import { Hono } from "hono";
import { Env, Variables, Course, Lesson, Category, Review } from "../types";
import { query, queryOne, execute, apiResponse, successResponse, errorResponse, internalErrorResponse } from "../lib/db";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

function enrichCourse(course: any): any {
  const syllabus = course.syllabus || [];
  const totalDuration = syllabus.reduce(
    (sum: number, lesson: any) => sum + (lesson.duration_seconds || 0),
    0
  );
  const publicSyllabus = syllabus.map((lesson: any) => {
    const { drive_file_id, ...rest } = lesson;
    return rest;
  });
  return {
    id: course._id,
    ...Object.fromEntries(
      Object.entries(course).filter(([k]) => k !== "_id")
    ),
    syllabus: publicSyllabus,
    total_duration_seconds: totalDuration,
  };
}

app.get("/categories", async (c) => {
  try {
    const categories = await query<Category>(c.env, "SELECT * FROM categories");
    return c.json(
      apiResponse(
        true,
        categories.map((cat) => ({
          id: cat._id,
          ...Object.fromEntries(
            Object.entries(cat).filter(([k]) => k !== "_id")
          ),
        })),
        null,
        null
      ),
      200
    );
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.get("/categories/:slug", async (c) => {
  try {
    const slug = c.req.param("slug");
    const category = await queryOne<Category>(
      c.env,
      "SELECT * FROM categories WHERE slug = ?",
      [slug]
    );
    if (!category) {
      return c.json({ success: false, data: null, error: "Category not found", meta: null }, 404);
    }
    return c.json(
      apiResponse(
        true,
        {
          id: category._id,
          ...Object.fromEntries(
            Object.entries(category).filter(([k]) => k !== "_id")
          ),
        },
        null,
        null
      ),
      200
    );
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.get("/courses", async (c) => {
  try {
    const category = c.req.query("category");
    const search = c.req.query("search");
    const sortBy = c.req.query("sort_by");
    const page = parseInt(c.req.query("page") || "1");
    const perPage = parseInt(c.req.query("per_page") || "20");
    const maxLessonDuration = parseInt(c.req.query("max_lesson_duration") || "0");
    const offset = (page - 1) * perPage;

    let sql = "SELECT * FROM courses";
    const params: any[] = [];

    if (category) {
      sql += " WHERE category_slug = ?";
      params.push(category);
    }

    if (search) {
      sql += category ? " AND" : " WHERE";
      sql += " (title LIKE ? OR description LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }

    sql += ` LIMIT ? OFFSET ?`;
    params.push(perPage, offset);

    const courses = await query<Course>(c.env, sql, params);
    const enriched = courses.map(enrichCourse);

    let filtered = enriched;
    if (maxLessonDuration > 0) {
      filtered = enriched.filter((course) =>
        course.syllabus.some(
          (lesson: any) => lesson.duration_seconds <= maxLessonDuration
        )
      );
    }

    return c.json(
      apiResponse(true, filtered, null, { page, per_page: perPage, total: filtered.length }),
      200
    );
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.get("/courses/:slug", async (c) => {
  try {
    const slug = c.req.param("slug");
    const course = await queryOne<Course>(
      c.env,
      "SELECT * FROM courses WHERE slug = ?",
      [slug]
    );
    if (!course) {
      return c.json({ success: false, data: null, error: "Course not found", meta: null }, 404);
    }
    return c.json(apiResponse(true, enrichCourse(course), null, null), 200);
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.post("/reviews", async (c) => {
  try {
    const body = await c.req.json<{
      name: string;
      role: string;
      rating: number;
      outcome: string;
      quote: string;
    }>();
    const { name, role, rating, outcome, quote } = body;
    const reviewId = `rev-${Date.now()}`;
    const now = new Date().toISOString();
    await execute(
      c.env,
      "INSERT INTO reviews (_id, name, role, rating, outcome, quote, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [reviewId, name, role, rating, outcome, quote, now]
    );
    return c.json(
      apiResponse(
        true,
        { id: reviewId, name, role, rating, outcome, quote, created_at: now },
        null,
        null
      ),
      201
    );
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.get("/recommendations", async (c) => {
  try {
    const limit = parseInt(c.req.query("limit") || "10");
    const courses = await query<Course>(
      c.env,
      "SELECT * FROM courses ORDER BY created_at DESC LIMIT ?",
      [limit]
    );
    return c.json(apiResponse(true, courses.map(enrichCourse), null, null), 200);
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.get("/courses/:course_id/similar", async (c) => {
  try {
    const courseId = c.req.param("course_id");
    const limit = parseInt(c.req.query("limit") || "6");
    const courses = await query<Course>(
      c.env,
      "SELECT * FROM courses WHERE _id != ? LIMIT ?",
      [courseId, limit]
    );
    return c.json(apiResponse(true, courses.map(enrichCourse), null, null), 200);
  } catch (error) {
    return internalErrorResponse(error);
  }
});

app.get("/stats", async (c) => {
  try {
    const courses = await query<Course>(c.env, "SELECT * FROM courses");
    const users = await query<any>(c.env, "SELECT * FROM users");
    const reviews = await query<Review>(c.env, "SELECT * FROM reviews");

    const totalCourses = courses.length;
    const totalMembers = users.length;
    const totalHours = courses.reduce(
      (sum, course) =>
        sum +
        course.syllabus.reduce(
          (s, lesson) => s + (lesson.duration_seconds || 0),
          0
        ),
      0
    ) / 3600;
    const avgRating =
      reviews.length > 0
        ? reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length
        : 0;

    return c.json(
      apiResponse(
        true,
        {
          total_courses: totalCourses,
          total_members: totalMembers,
          total_hours: Math.round(totalHours),
          average_rating: Math.round(avgRating * 10) / 10,
        },
        null,
        null
      ),
      200
    );
  } catch (error) {
    return internalErrorResponse(error);
  }
});

export default app;
