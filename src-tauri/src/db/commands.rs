use tauri::State;
use sqlx::{SqlitePool, Row};
use uuid::Uuid;
use serde_json;

use crate::models::*;

fn parse_tags(tags_json: Option<&str>) -> Vec<String> {
    tags_json
        .and_then(|s| serde_json::from_str::<Vec<String>>(s).ok())
        .unwrap_or_default()
}

fn serialize_tags(tags: &[String]) -> Option<String> {
    if tags.is_empty() {
        None
    } else {
        serde_json::to_string(tags).ok()
    }
}

// ==================== Task CRUD ====================

#[tauri::command]
pub async fn get_tasks(db: State<'_, SqlitePool>) -> Result<Vec<Task>, String> {
    let pool = db.inner();

    let rows = sqlx::query(
        "SELECT id, title, description, completed, color, tags, estimated_duration, created_at, updated_at FROM tasks ORDER BY created_at DESC"
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("获取任务失败: {}", e))?;

    let tasks: Vec<Task> = rows
        .into_iter()
        .map(|row| Task {
            id: row.get("id"),
            title: row.get("title"),
            description: row.get("description"),
            completed: row.get::<i64, _>("completed") != 0,
            color: row.get("color"),
            tags: parse_tags(row.get::<Option<&str>, _>("tags")),
            estimated_duration: row.get("estimated_duration"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        })
        .collect();

    Ok(tasks)
}

#[tauri::command]
pub async fn get_task(db: State<'_, SqlitePool>, id: String) -> Result<Option<Task>, String> {
    let pool = db.inner();

    let row = sqlx::query(
        "SELECT id, title, description, completed, color, tags, estimated_duration, created_at, updated_at FROM tasks WHERE id = ?"
    )
    .bind(&id)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("获取任务失败: {}", e))?;

    Ok(row.map(|row| Task {
        id: row.get("id"),
        title: row.get("title"),
        description: row.get("description"),
        completed: row.get::<i64, _>("completed") != 0,
        color: row.get("color"),
        tags: parse_tags(row.get::<Option<&str>, _>("tags")),
        estimated_duration: row.get("estimated_duration"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }))
}

#[tauri::command]
pub async fn create_task(db: State<'_, SqlitePool>, input: CreateTaskInput) -> Result<Task, String> {
    let pool = db.inner();

    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let tags_json = serialize_tags(&input.tags);

    sqlx::query(
        "INSERT INTO tasks (id, title, description, completed, color, tags, estimated_duration, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(&input.title)
    .bind(&input.description)
    .bind(&input.color)
    .bind(&tags_json)
    .bind(&input.estimated_duration)
    .bind(&now)
    .bind(&now)
    .execute(pool)
    .await
    .map_err(|e| format!("创建任务失败: {}", e))?;

    Ok(Task {
        id,
        title: input.title,
        description: input.description,
        completed: false,
        color: input.color,
        tags: input.tags,
        estimated_duration: input.estimated_duration,
        created_at: now.clone(),
        updated_at: now,
    })
}

#[tauri::command]
pub async fn update_task(db: State<'_, SqlitePool>, id: String, input: UpdateTaskInput) -> Result<Task, String> {
    let pool = db.inner();

    let existing_row = sqlx::query(
        "SELECT id, title, description, completed, color, tags, estimated_duration, created_at, updated_at FROM tasks WHERE id = ?"
    )
    .bind(&id)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("获取任务失败: {}", e))?
    .ok_or_else(|| "任务不存在".to_string())?;

    let existing_tags = parse_tags(existing_row.get::<Option<&str>, _>("tags"));
    let new_tags = input.tags.unwrap_or(existing_tags.clone());
    let tags_json = serialize_tags(&new_tags);

    let now = chrono::Utc::now().to_rfc3339();
    let updated = Task {
        id: id.clone(),
        title: input.title.unwrap_or_else(|| existing_row.get("title")),
        description: input.description.or_else(|| existing_row.get("description")),
        completed: input.completed.unwrap_or_else(|| existing_row.get::<i64, _>("completed") != 0),
        color: input.color.or_else(|| existing_row.get("color")),
        tags: new_tags,
        estimated_duration: input.estimated_duration.or_else(|| existing_row.get("estimated_duration")),
        created_at: existing_row.get("created_at"),
        updated_at: now.clone(),
    };

    sqlx::query(
        "UPDATE tasks SET title = ?, description = ?, completed = ?, color = ?, tags = ?, estimated_duration = ?, updated_at = ? WHERE id = ?"
    )
    .bind(&updated.title)
    .bind(&updated.description)
    .bind(updated.completed as i64)
    .bind(&updated.color)
    .bind(&tags_json)
    .bind(&updated.estimated_duration)
    .bind(&updated.updated_at)
    .bind(&id)
    .execute(pool)
    .await
    .map_err(|e| format!("更新任务失败: {}", e))?;

    Ok(updated)
}

#[tauri::command]
pub async fn delete_task(db: State<'_, SqlitePool>, id: String) -> Result<(), String> {
    let pool = db.inner();

    sqlx::query("DELETE FROM tasks WHERE id = ?")
        .bind(&id)
        .execute(pool)
        .await
        .map_err(|e| format!("删除任务失败: {}", e))?;

    Ok(())
}

// ==================== TimeBlock CRUD ====================

#[tauri::command]
pub async fn get_projects(db: State<'_, SqlitePool>) -> Result<Vec<Project>, String> {
    let pool = db.inner();

    sqlx::query_as::<_, Project>(
        "SELECT id, name, path, color, created_at, updated_at FROM projects ORDER BY updated_at DESC, created_at DESC"
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("获取项目失败: {}", e))
}

#[tauri::command]
pub async fn create_project(db: State<'_, SqlitePool>, input: CreateProjectInput) -> Result<Project, String> {
    let pool = db.inner();

    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    sqlx::query(
        "INSERT INTO projects (id, name, path, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(&input.name)
    .bind(&input.path)
    .bind(&input.color)
    .bind(&now)
    .bind(&now)
    .execute(pool)
    .await
    .map_err(|e| format!("创建项目失败: {}", e))?;

    Ok(Project {
        id,
        name: input.name,
        path: input.path,
        color: input.color,
        created_at: now.clone(),
        updated_at: now,
    })
}

#[tauri::command]
pub async fn get_time_blocks(
    db: State<'_, SqlitePool>,
    start_date: Option<String>,
    end_date: Option<String>,
) -> Result<Vec<TimeBlock>, String> {
    let pool = db.inner();

    if let (Some(start), Some(end)) = (start_date, end_date) {
        sqlx::query_as::<_, TimeBlock>(
            "SELECT id, title, start_time, end_time, all_day, color, editable, completion_status, is_pomodoro, task_id, project_id, created_at, updated_at FROM time_blocks WHERE start_time < ? AND end_time > ? ORDER BY start_time ASC"
        )
        .bind(&end)
        .bind(&start)
        .fetch_all(pool)
        .await
        .map_err(|e| format!("获取时间块失败: {}", e))
    } else {
        sqlx::query_as::<_, TimeBlock>(
            "SELECT id, title, start_time, end_time, all_day, color, editable, completion_status, is_pomodoro, task_id, project_id, created_at, updated_at FROM time_blocks ORDER BY start_time ASC"
        )
        .fetch_all(pool)
        .await
        .map_err(|e| format!("获取时间块失败: {}", e))
    }
}

#[tauri::command]
pub async fn get_time_block(db: State<'_, SqlitePool>, id: String) -> Result<Option<TimeBlock>, String> {
    let pool = db.inner();

    sqlx::query_as::<_, TimeBlock>(
        "SELECT id, title, start_time, end_time, all_day, color, editable, completion_status, is_pomodoro, task_id, project_id, created_at, updated_at FROM time_blocks WHERE id = ?"
    )
    .bind(&id)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("获取时间块失败: {}", e))
}

#[tauri::command]
pub async fn create_time_block(db: State<'_, SqlitePool>, input: CreateTimeBlockInput) -> Result<TimeBlock, String> {
    let pool = db.inner();

    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    sqlx::query(
        "INSERT INTO time_blocks (id, title, start_time, end_time, all_day, color, editable, completion_status, is_pomodoro, task_id, project_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, NULL, ?, ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(&input.title)
    .bind(&input.start_time)
    .bind(&input.end_time)
    .bind(&input.all_day.unwrap_or(false))
    .bind(&input.color)
    .bind(&input.is_pomodoro.unwrap_or(false))
    .bind(&input.task_id)
    .bind(&input.project_id)
    .bind(&now)
    .bind(&now)
    .execute(pool)
    .await
    .map_err(|e| format!("创建时间块失败: {}", e))?;

    Ok(TimeBlock {
        id,
        title: input.title,
        start_time: input.start_time,
        end_time: input.end_time,
        all_day: input.all_day.unwrap_or(false),
        color: input.color,
        editable: true,
        completion_status: None,
        is_pomodoro: input.is_pomodoro.unwrap_or(false),
        task_id: input.task_id,
        project_id: input.project_id,
        created_at: now.clone(),
        updated_at: now,
    })
}

#[tauri::command]
pub async fn update_time_block(db: State<'_, SqlitePool>, id: String, input: UpdateTimeBlockInput) -> Result<TimeBlock, String> {
    let pool = db.inner();

    let existing = sqlx::query_as::<_, TimeBlock>(
        "SELECT id, title, start_time, end_time, all_day, color, editable, completion_status, is_pomodoro, task_id, project_id, created_at, updated_at FROM time_blocks WHERE id = ?"
    )
    .bind(&id)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("获取时间块失败: {}", e))?
    .ok_or_else(|| "时间块不存在".to_string())?;

    let now = chrono::Utc::now().to_rfc3339();
    let updated = TimeBlock {
        id: id.clone(),
        title: input.title.unwrap_or(existing.title),
        start_time: input.start_time.unwrap_or(existing.start_time),
        end_time: input.end_time.unwrap_or(existing.end_time),
        all_day: input.all_day.unwrap_or(existing.all_day),
        color: input.color.or(existing.color),
        editable: existing.editable,
        completion_status: if input.clear_completion_status.unwrap_or(false) {
            None
        } else {
            input.completion_status.or(existing.completion_status)
        },
        is_pomodoro: existing.is_pomodoro,
        task_id: input.task_id.or(existing.task_id),
        project_id: input.project_id.or(existing.project_id),
        created_at: existing.created_at,
        updated_at: now,
    };

    sqlx::query(
        "UPDATE time_blocks SET title = ?, start_time = ?, end_time = ?, all_day = ?, color = ?, completion_status = ?, task_id = ?, project_id = ?, updated_at = ? WHERE id = ?"
    )
    .bind(&updated.title)
    .bind(&updated.start_time)
    .bind(&updated.end_time)
    .bind(&updated.all_day)
    .bind(&updated.color)
    .bind(&updated.completion_status)
    .bind(&updated.task_id)
    .bind(&updated.project_id)
    .bind(&updated.updated_at)
    .bind(&id)
    .execute(pool)
    .await
    .map_err(|e| format!("更新时间块失败: {}", e))?;

    Ok(updated)
}

#[tauri::command]
pub async fn delete_time_block(db: State<'_, SqlitePool>, id: String) -> Result<(), String> {
    let pool = db.inner();

    sqlx::query("DELETE FROM time_blocks WHERE id = ?")
        .bind(&id)
        .execute(pool)
        .await
        .map_err(|e| format!("删除时间块失败: {}", e))?;

    Ok(())
}
