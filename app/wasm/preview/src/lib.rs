use wasm_bindgen::prelude::*;
use serde::Deserialize;

#[derive(Deserialize)]
struct Hole {
    dx: f64,
    dy: f64,
    nominal: f64,
    cut: Option<f64>,
    spec: Option<f64>,
    selected: bool,
}

#[derive(Deserialize)]
struct State {
    width: f64,
    height: f64,
    depth: f64,
    showGhost: bool,
    holes: Vec<Hole>,
    showDims: bool,
    zoomMode: String,
}

#[wasm_bindgen]
pub fn generate_preview(state_json: &str) -> String {
    let parsed: State = match serde_json::from_str(state_json) {
        Ok(s) => s,
        Err(e) => return format!("<svg><text x='4' y='14' fill='red'>state parse error: {}</text></svg>", e),
    };
    // Simplified scaling logic matching JS (subset)
    let view_w = 480.0;
    let view_h = 360.0;
    let margin = 12.0;
    let max_w = view_w - margin * 2.0;
    let max_h = view_h - margin * 2.0;
    let base_scale = f64::min(max_w / parsed.width, max_h / parsed.height);
    let zoom_factor = match parsed.zoomMode.as_str() {"close"=>0.60,"normal"=>0.35,"wide"=>0.25,"default"=>0.45,_=>0.45};
    let scale = base_scale * zoom_factor;
    let disp_w = parsed.width * scale;
    let disp_h = parsed.height * scale;
    let x = (view_w - disp_w) / 2.0;
    let y = (view_h - disp_h) / 2.0;
    let front_rect = format!("<rect x='{}' y='{}' width='{}' height='{}' class='front' />", x, y, disp_w, disp_h);

    // Ghost panel (simplified) + connecting edges
    let mut ghost_svg = String::new();
    if parsed.showGhost {
        let depth_proj = f64::min(20.0 + parsed.depth * 2.0, 140.0);
        let shift = depth_proj * 0.6;
        let gbx = x + shift;
        let gby = y + shift;
        ghost_svg.push_str(&format!("<rect x='{}' y='{}' width='{}' height='{}' class='ghost-back' />", gbx, gby, disp_w, disp_h));
        ghost_svg.push_str(&format!("<line x1='{}' y1='{}' x2='{}' y2='{}' class='ghost-edge' />", x, y, gbx, gby));
        ghost_svg.push_str(&format!("<line x1='{}' y1='{}' x2='{}' y2='{}' class='ghost-edge' />", x+disp_w, y, gbx+disp_w, gby));
        ghost_svg.push_str(&format!("<line x1='{}' y1='{}' x2='{}' y2='{}' class='ghost-edge' />", x, y+disp_h, gbx, gby+disp_h));
        ghost_svg.push_str(&format!("<line x1='{}' y1='{}' x2='{}' y2='{}' class='ghost-edge' />", x+disp_w, y+disp_h, gbx+disp_w, gby+disp_h));
    }

    // Holes
    let edge_margin = 0.5_f64.max(0.25);
    let mut holes_svg = String::new();
    for (idx, h) in parsed.holes.iter().enumerate() {
        let nominal = if h.nominal > 0.0 { h.nominal } else { 12.0 };
        let dia = h.spec.or(h.cut).unwrap_or(nominal * 0.93).min(parsed.width).min(parsed.height);
        let r = dia / 2.0;
        let mut hx = parsed.width / 2.0 + h.dx;
        let mut hy = parsed.height / 2.0 + h.dy;
        if hx - r - edge_margin < 0.0 { hx = r + edge_margin; }
        if hx + r + edge_margin > parsed.width { hx = parsed.width - r - edge_margin; }
        if hy - r - edge_margin < 0.0 { hy = r + edge_margin; }
        if hy + r - edge_margin > parsed.height { hy = parsed.height - r - edge_margin; }
        let disp_x = x + (hx - parsed.width / 2.0) * scale + disp_w / 2.0;
        let disp_y = y + (hy - parsed.height / 2.0) * scale + disp_h / 2.0;
        let disp_r = r * scale;
        let badge_type = if h.spec.is_some() {"SPEC"} else if h.cut.is_some() {"CUT"} else {"EST"};
        let badge_y = disp_y - disp_r - 10.0;
        let inner_font_px = (disp_r * 0.55).min(15.0).max(6.0);
        holes_svg.push_str(&format!("<g class='hole'><circle cx='{}' cy='{}' r='{}' class='cutout{}' data-idx='{}' />", disp_x, disp_y, disp_r, if h.selected {" selected"} else {""}, idx));
        holes_svg.push_str(&format!("<text x='{}' y='{}' text-anchor='middle' class='badge'>{}</text>", disp_x, badge_y, badge_type));
        holes_svg.push_str(&format!("<text x='{}' y='{}' text-anchor='middle' dominant-baseline='middle' style='font:{}px system-ui;fill:#ffd28c;'>{:.2}\"</text>", disp_x, disp_y, inner_font_px, dia));
    }
    let cutouts_group = format!("<g class='cutouts'>{}</g>", holes_svg);

    // Dimensions (subset; width & height only when showDims)
    let mut dims = String::new();
    if parsed.showDims {
        let dim_line_color = "#555";
        let dim_text_color = "#222";
        let label_font = "font:13px system-ui;";
        let wy = y - 20.0;
        dims.push_str(&format!("<line x1='{}' y1='{}' x2='{}' y2='{}' stroke='{}' stroke-width='1' />", x, wy, x+disp_w, wy, dim_line_color));
        dims.push_str(&format!("<text x='{}' y='{}' text-anchor='middle' fill='{}' style='{}'>W {:.2} in</text>", x+disp_w/2.0, wy-6.0, dim_text_color, label_font, parsed.width));
        let hx_right = x + disp_w + 30.0;
        dims.push_str(&format!("<line x1='{}' y1='{}' x2='{}' y2='{}' stroke='{}' stroke-width='1' />", hx_right, y, hx_right, y+disp_h, dim_line_color));
        dims.push_str(&format!("<text x='{}' y='{}' text-anchor='start' dominant-baseline='middle' fill='{}' style='{}'>H {:.2} in</text>", hx_right+4.0, y+disp_h/2.0, dim_text_color, label_font, parsed.height));
    }

    format!(r#"<svg viewBox='0 0 {vw} {vh}' preserveAspectRatio='xMidYMid meet'>
      <defs>
        <style>
          .front {{ fill:#1e2630; stroke:#55687a; stroke-width:1.5; }}
          .ghost-back {{ fill:none; stroke:#3a4855; stroke-width:1.2; stroke-dasharray:4 3; opacity:.25; }}
          .ghost-edge {{ stroke:#3a4855; stroke-width:1; stroke-dasharray:4 3; opacity:.35; }}
          .cutout {{ fill:#111; stroke:#ff9d4f; stroke-width:1.2; }}
          .cutout.selected {{ stroke:#ffd28c; stroke-width:1.6; }}
          .badge {{ font:10px system-ui; fill:#fff; stroke:#222; stroke-width:.4; paint-order:stroke; }}
        </style>
      </defs>
      <rect x='0' y='0' width='{vw}' height='{vh}' fill='#f3e2c9' />
      {ghost}
      {front}
      {cutouts}
      {dims}
    </svg>"#, vw=view_w, vh=view_h, ghost=ghost_svg, front=front_rect, cutouts=cutouts_group, dims=dims)
}
