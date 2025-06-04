
#[cfg(windows)]
pub mod win_timer {
    use winapi::um::timeapi;
    static mut TIMER_RESOLUTION_SET: bool = false;

    pub fn enable() -> Result<(), String> {
        unsafe {
            if timeapi::timeBeginPeriod(1) == winapi::um::mmsystem::TIMERR_NOERROR {
                TIMER_RESOLUTION_SET = true;
                Ok(())
            } else {
                Err("Failed to set timer resolution".into())
            }
        }
    }

    pub fn disable() {
        unsafe {
            if TIMER_RESOLUTION_SET {
                timeapi::timeEndPeriod(1);
                TIMER_RESOLUTION_SET = false;
            }
        }
    }
}