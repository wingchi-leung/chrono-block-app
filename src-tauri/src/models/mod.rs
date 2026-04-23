use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Task {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub completed: bool,
    pub color: Option<String>,
    #[sqlx(default)]
    #[serde(default)]
    pub tags: Vec<String>,
    pub estimated_duration: Option<i32>,
    #[sqlx(default)]
    pub deleted: bool,
    pub deleted_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub path: Option<String>,
    pub color: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct TimeBlock {
    pub id: String,
    pub title: String,
    pub start_time: String,
    pub end_time: String,
    pub all_day: bool,
    pub color: Option<String>,
    pub editable: bool,
    pub completion_status: Option<String>,
    pub is_pomodoro: bool,
    pub task_id: Option<String>,
    pub project_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateTaskInput {
    pub title: String,
    pub description: Option<String>,
    pub color: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    pub estimated_duration: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateTaskInput {
    pub title: Option<String>,
    pub description: Option<String>,
    pub completed: Option<bool>,
    pub color: Option<String>,
    pub tags: Option<Vec<String>>,
    pub estimated_duration: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateTimeBlockInput {
    pub title: String,
    pub start_time: String,
    pub end_time: String,
    pub all_day: Option<bool>,
    pub color: Option<String>,
    pub task_id: Option<String>,
    pub project_id: Option<String>,
    pub is_pomodoro: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateTimeBlockInput {
    pub title: Option<String>,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub all_day: Option<bool>,
    pub color: Option<String>,
    pub completion_status: Option<String>,
    pub clear_completion_status: Option<bool>,
    pub task_id: Option<String>,
    pub project_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateProjectInput {
    pub name: String,
    pub path: Option<String>,
    pub color: Option<String>,
}
