use serde::{Deserialize, Serialize};
use tauri::Emitter;
use tracing::info;


#[derive(Serialize, Deserialize)]
pub struct SimPosition {
    pub id: u32,
    pub lat: f64,
    pub lon: f64,
    pub alt: f64,
    pub time: f64,
}

use std::{
    sync::{Arc, Mutex},
};

#[derive(Clone, serde::Serialize)]
struct SimStepPayload {
    step: usize,
}
use std::thread::JoinHandle;

pub struct SimTimerState {
    pub handle: Option<JoinHandle<()>>,
    pub current_step: usize,
    pub running: bool,
    pub total_steps: usize,
}
#[tauri::command]
pub fn start_simulation_timer(
    app: tauri::AppHandle,
    total_steps: usize,
    interval_ms: u64,
    state: tauri::State<Arc<Mutex<SimTimerState>>>,
) {
    let app_handle = app.clone();
    let state_arc = state.inner().clone();

    {
        let mut state_guard = state_arc.lock().unwrap();
        if state_guard.running {
            return; // Already running
        }

        state_guard.running = true;
        state_guard.total_steps = total_steps;
    }

    let thread_state = state_arc.clone();

    let handle = std::thread::spawn(move || {
        loop {
            {
                let mut state = thread_state.lock().unwrap();

                if !state.running {
                    break; // Stop if paused
                }

                if state.current_step >= state.total_steps {
                    let _ = app_handle.emit("simulation_complete", ());
                    state.running = false;
                    break;
                }
                info!("running {}", state.running);
                let _ = app_handle.emit(
                    "simulation_step",
                    SimStepPayload {
                        step: state.current_step,
                    },
                );

                state.current_step += 1;
            }

            std::thread::sleep(std::time::Duration::from_millis(interval_ms));
        }
    });

    let mut guard = state_arc.lock().unwrap();
    guard.handle = Some(handle);
}
#[tauri::command]
pub fn reset_simulation_timer(state: tauri::State<Arc<Mutex<SimTimerState>>>) {
    let mut guard = state.lock().unwrap();

    guard.running = false;
    guard.current_step = 0;

    if let Some(_handle) = guard.handle.take() {
        // Let thread die if needed
    }
}

#[tauri::command]
pub fn stop_simulation_timer(state: tauri::State<Arc<Mutex<SimTimerState>>>) {
    let mut guard = state.lock().unwrap();

    if guard.running {
        guard.running = false;

        if let Some(_handle) = guard.handle.take() {

            // Let thread stop gracefully
            // Do not reset step
            // Do not call `join()` to avoid blocking the main thread
        }
    }
}
