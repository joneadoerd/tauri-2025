use console_subscriber;
use std::sync::OnceLock;
use tracing_appender::rolling;
use tracing_subscriber::{fmt, layer::SubscriberExt, util::SubscriberInitExt, EnvFilter, Layer};

static LOG_GUARD: OnceLock<tracing_appender::non_blocking::WorkerGuard> = OnceLock::new();

pub fn init_logging() {
    // Log file will be saved in the "logs" directory, rotating daily
    let file_appender = rolling::daily("../logs", "backend.log");
    let (non_blocking, guard) = tracing_appender::non_blocking(file_appender);

    let file_layer = fmt::layer().with_writer(non_blocking).with_ansi(false);

    let env_filter =
        EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info,tao=error"));
    #[allow(unused_variables)]
    let registry = tracing_subscriber::registry()
        .with(env_filter)
        .with(file_layer);

    #[cfg(debug_assertions)]
    {
        // In development, print only info, warn, error to console
        let stdout_layer = fmt::layer()
            .with_ansi(true)
            .with_filter(tracing_subscriber::filter::LevelFilter::INFO);
        tracing_subscriber::registry()
            .with(console_subscriber::spawn())
            .with(stdout_layer)
            .init();
    }
    #[cfg(not(debug_assertions))]
    {
        // In release, just init the registry
        registry.init();
    }

    let _ = LOG_GUARD.set(guard);
}
