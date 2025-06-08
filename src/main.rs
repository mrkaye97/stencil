use sqlx::postgres::PgPoolOptions;
use std::{net::SocketAddr, sync::Arc};
use tokio::net::TcpListener;
use tower_http::cors::CorsLayer;
use tracing_subscriber;

mod handlers;
use handlers::{create_api_router, create_otel_router};

#[tokio::main]
async fn main() -> Result<(), sqlx::Error> {
    tracing_subscriber::fmt::init();

    let _ = dotenvy::dotenv();
    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let http_port = std::env::var("HTTP_PORT")
        .expect("HTTP_PORT must be set")
        .parse::<u16>()
        .expect("HTTP_PORT must be a valid number");

    let pool = PgPoolOptions::new()
        .max_connections(10)
        .connect(&database_url)
        .await?;

    sqlx::migrate!("./migrations").run(&pool).await?;

    let pool = Arc::new(pool);

    let otel_router = create_otel_router(pool.clone());
    let api_router = create_api_router(pool.clone()).layer(CorsLayer::permissive());

    let otel_addr = SocketAddr::from(([0, 0, 0, 0], 4317));
    let otel_listener = TcpListener::bind(otel_addr).await.unwrap();

    let api_addr = SocketAddr::from(([0, 0, 0, 0], http_port));
    let api_listener = TcpListener::bind(api_addr).await.unwrap();

    tracing::info!("OpenTelemetry server listening on {}", otel_addr);
    tracing::info!("API server listening on {}", api_addr);

    tokio::try_join!(
        axum::serve(
            otel_listener,
            otel_router.into_make_service_with_connect_info::<SocketAddr>(),
        ),
        axum::serve(
            api_listener,
            api_router.into_make_service_with_connect_info::<SocketAddr>(),
        )
    )
    .unwrap();

    Ok(())
}
