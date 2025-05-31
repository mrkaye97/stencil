use axum::Router;
use axum::routing::get;

async fn root() -> &'static str {
    "Hello, World!"
}
pub fn handlers_routes() -> Router {
    Router::new().route("/", get(root))
}
