pub mod migrations;
pub mod commands;

use std::fs;
use std::path::PathBuf;

use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqliteRow, SqliteSynchronous};
use sqlx::{Row, SqlitePool};
use tauri::{AppHandle, Manager};

pub use migrations::MIGRATIONS;
pub use commands::*;

pub async fn init_pool(app: &AppHandle) -> Result<SqlitePool, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("获取应用数据目录失败: {}", e))?;

    fs::create_dir_all(&app_data_dir)
        .map_err(|e| format!("创建应用数据目录失败: {}", e))?;

    let database_path = resolve_database_path(&app_data_dir)?;
    let database_url = format!(
        "sqlite://{}",
        database_path.to_string_lossy().replace('\\', "/")
    );

    let options = database_url
        .parse::<SqliteConnectOptions>()
        .map_err(|e| format!("解析数据库连接失败: {}", e))?
        .create_if_missing(true)
        .journal_mode(SqliteJournalMode::Wal)
        .synchronous(SqliteSynchronous::Normal);

    let pool = SqlitePool::connect_with(options)
        .await
        .map_err(|e| format!("连接数据库失败: {}", e))?;

    sqlx::raw_sql(MIGRATIONS)
        .execute(&pool)
        .await
        .map_err(|e| format!("执行数据库迁移失败: {}", e))?;

    ensure_project_schema(&pool).await?;

    Ok(pool)
}

fn resolve_database_path(app_data_dir: &PathBuf) -> Result<PathBuf, String> {
    let channel_dir_name = if cfg!(debug_assertions) { "dev" } else { "release" };
    let channel_data_dir = app_data_dir.join(channel_dir_name);

    fs::create_dir_all(&channel_data_dir)
        .map_err(|e| format!("创建{}数据目录失败: {}", channel_dir_name, e))?;

    if !cfg!(debug_assertions) {
        quarantine_legacy_database(app_data_dir, &channel_data_dir)?;
    }

    Ok(channel_data_dir.join("chronoblock.db"))
}

fn quarantine_legacy_database(app_data_dir: &PathBuf, channel_data_dir: &PathBuf) -> Result<(), String> {
    let legacy_database_path = app_data_dir.join("chronoblock.db");
    let release_database_path = channel_data_dir.join("chronoblock.db");

    if !legacy_database_path.exists() || release_database_path.exists() {
        return Ok(());
    }

    let legacy_backup_dir = app_data_dir.join("legacy");
    fs::create_dir_all(&legacy_backup_dir)
        .map_err(|e| format!("创建旧数据备份目录失败: {}", e))?;

    let legacy_backup_path = legacy_backup_dir.join("chronoblock-pre-release.db");

    if legacy_backup_path.exists() {
        fs::remove_file(&legacy_backup_path)
            .map_err(|e| format!("清理旧数据备份失败: {}", e))?;
    }

    fs::rename(&legacy_database_path, &legacy_backup_path)
        .map_err(|e| format!("隔离旧版本数据库失败: {}", e))?;

    Ok(())
}

async fn ensure_project_schema(pool: &SqlitePool) -> Result<(), String> {
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY NOT NULL,
            name TEXT NOT NULL,
            path TEXT,
            color TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )"
    )
    .execute(pool)
    .await
    .map_err(|e| format!("创建项目表失败: {}", e))?;

    let columns = sqlx::query("PRAGMA table_info(time_blocks)")
        .map(|row: SqliteRow| row.get::<String, _>("name"))
        .fetch_all(pool)
        .await
        .map_err(|e| format!("读取时间块表结构失败: {}", e))?;

    if !columns.iter().any(|column| column == "project_id") {
        sqlx::query("ALTER TABLE time_blocks ADD COLUMN project_id TEXT REFERENCES projects(id) ON DELETE SET NULL")
            .execute(pool)
            .await
            .map_err(|e| format!("更新时间块项目字段失败: {}", e))?;
    }

    let task_columns = sqlx::query("PRAGMA table_info(tasks)")
        .map(|row: SqliteRow| row.get::<String, _>("name"))
        .fetch_all(pool)
        .await
        .map_err(|e| format!("读取任务表结构失败: {}", e))?;

    if !task_columns.iter().any(|column| column == "tags") {
        sqlx::query("ALTER TABLE tasks ADD COLUMN tags TEXT")
            .execute(pool)
            .await
            .map_err(|e| format!("更新任务标签字段失败: {}", e))?;
    }

    if !task_columns.iter().any(|column| column == "deleted") {
        sqlx::query("ALTER TABLE tasks ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0")
            .execute(pool)
            .await
            .map_err(|e| format!("更新任务删除字段失败: {}", e))?;
    }

    if !task_columns.iter().any(|column| column == "deleted_at") {
        sqlx::query("ALTER TABLE tasks ADD COLUMN deleted_at TEXT")
            .execute(pool)
            .await
            .map_err(|e| format!("更新任务删除时间字段失败: {}", e))?;
    }

    if !task_columns.iter().any(|column| column == "due_date") {
        sqlx::query("ALTER TABLE tasks ADD COLUMN due_date TEXT")
            .execute(pool)
            .await
            .map_err(|e| format!("更新任务截止日期字段失败: {}", e))?;
    }

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_tasks_deleted ON tasks(deleted)")
        .execute(pool)
        .await
        .map_err(|e| format!("创建任务删除状态索引失败: {}", e))?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(name)")
        .execute(pool)
        .await
        .map_err(|e| format!("创建项目名称索引失败: {}", e))?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_time_blocks_project_id ON time_blocks(project_id)")
        .execute(pool)
        .await
        .map_err(|e| format!("创建时间块项目索引失败: {}", e))?;

    Ok(())
}
