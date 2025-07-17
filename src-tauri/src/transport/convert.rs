use std::f64::consts::PI;

use crate::packet::{Lla, Ned};

const EARTH_RADIUS_M: f64 = 6_378_137.0; // in meters/// Converts degrees to radians

fn deg_to_rad(deg: f64) -> f64 {
    deg * PI / 180.0
}

/// Converts radians to degrees
fn rad_to_deg(rad: f64) -> f64 {
    rad * 180.0 / PI
}

/// Converts LLA to radians (assumes input is in degrees)
pub fn lla_to_radians(lla: &Lla) -> Lla {
    Lla {
        lat: deg_to_rad(lla.lat),
        lon: deg_to_rad(lla.lon),
        alt: lla.alt,
    }
}

/// Converts LLA to degrees (assumes input is in radians)
pub fn lla_to_degrees(lla: &Lla) -> Lla {
    Lla {
        lat: rad_to_deg(lla.lat),
        lon: rad_to_deg(lla.lon),
        alt: lla.alt,
    }
}

/// Convert LLA to NED using flat Earth approximation
pub fn lla_to_ned(origin: &Lla, point: &Lla) -> Ned {
    // Convert both to radians
    let origin_rad = lla_to_radians(origin);
    let point_rad = lla_to_radians(point);

    let d_lat = point_rad.lat - origin_rad.lat;
    let d_lon = point_rad.lon - origin_rad.lon;
    let d_alt = point_rad.alt - origin_rad.alt;

    let north = d_lat * EARTH_RADIUS_M;
    let east = d_lon * EARTH_RADIUS_M * origin_rad.lat.cos();
    let down = -d_alt;

    Ned { north, east, down }
}

/// Convert NED back to LLA (flat Earth approximation)
pub fn ned_to_lla(origin: &Lla, ned: &Ned, output_in_degrees: bool) -> Lla {
    let origin_rad = lla_to_radians(origin);
    let d_lat = ned.north / EARTH_RADIUS_M;
    let d_lon = ned.east / (EARTH_RADIUS_M * origin_rad.lat.cos());
    let d_alt = -ned.down;

    let lat = origin_rad.lat + d_lat;
    let lon = origin_rad.lon + d_lon;
    let alt = origin_rad.alt + d_alt;

    let lla_rad = Lla { lat, lon, alt };
    if output_in_degrees {
        lla_to_degrees(&lla_rad)
    } else {
        lla_rad
    }
}

// fn main() {
//     // Example with degrees
//     let origin = LLA {
//         lat: 14.752556321159286,
//         lon: 42.965306989229525,
//         alt_m: 30.0,
//         unit: AngleUnit::Degrees,
//     };

//     let target = LLA {
//         lat: 14.912523675439516,
//         lon: 42.962560407272555,
//         alt_m: 28.0,
//         unit: AngleUnit::Degrees,
//     };

//     let ned = lla_to_ned(&origin, &target);
//     println!("NED: {:?}", ned);

//     // Convert back to LLA (degrees)
//     let lla_back = ned_to_lla(&origin, &ned, AngleUnit::Degrees);
//     println!("LLA (from NED, degrees): lat = {:.8}, lon = {:.8}, alt = {:.2}", lla_back.lat, lla_back.lon, lla_back.alt_m);

//     // Example with radians
//     let origin_rad = lla_to_radians(&origin);
//     let target_rad = lla_to_radians(&target);
//     let ned_rad = lla_to_ned(&origin_rad, &target_rad);
//     println!("NED (radians input): {:?}", ned_rad);

//     let lla_back_rad = ned_to_lla(&origin_rad, &ned_rad, AngleUnit::Radians);
//     println!("LLA (from NED, radians): lat = {:.8}, lon = {:.8}, alt = {:.2}", lla_back_rad.lat, lla_back_rad.lon, lla_back_rad.alt_m);
// }
