costumes
    "assets/blank.svg" as " ",
    "assets/text/caps/*.svg",
    "assets/text/lower/*.svg",
    "assets/text/nums/*.svg",
    "assets/text/`.svg",
    "assets/text/~.svg",
    "assets/text/!.svg",
    "assets/text/@.svg",
    "assets/text/#.svg",
    "assets/text/$.svg",
    "assets/text/percent.svg" as "%",
    "assets/text/^.svg",
    "assets/text/&.svg",
    "assets/text/mul.svg" as "*",
    "assets/text/(.svg",
    "assets/text/).svg",
    "assets/text/-.svg",
    "assets/text/_.svg",
    "assets/text/=.svg",
    "assets/text/+.svg",
    "assets/text/[.svg",
    "assets/text/].svg",
    "assets/text/backslash.svg" as "\\",
    "assets/text/semicolon.svg" as ";",
    "assets/text/'.svg",
    "assets/text/comma.svg" as ",",
    "assets/text/period.svg" as ".",
    "assets/text/forwardslash.svg" as "/",
    "assets/text/{.svg",
    "assets/text/}.svg",
    "assets/text/line.svg" as "|",
    "assets/text/colon.svg" as ":",
    "assets/text/doublequote.svg" as "\"",
    "assets/text/lessthan.svg" as "<",
    "assets/text/greaterthan.svg" as ">",
    "assets/text/question.svg" as "?";
hide;
%include std/math
%include libs/vector.gs

list char_lens "assets/text/char_lens.txt";

struct UDim2 {x, px, y, py};
struct RGBA {r, g, b, a};

%define COLOR(red, green, blue, alpha) RGBA{r: red, g: green, b: blue, a: alpha}
%define UDIM2(xScale, xOffset, yScale, yOffset) UDim2{x: xScale, px: xOffset, y: yScale, py: yOffset}

var h;
var s;
var v;

proc rgb_to_hsv r, g, b {
  local maxc = MAX($r, $g);
  maxc = MAX(maxc, $b);
  local minc = MIN($r, $g);
  minc = MIN(minc, $b);

  v = maxc;
  local delta = maxc - minc;

  if minc == maxc {
    h = 0;
    s = 0;
    stop_this_script;
  }

  s = delta / maxc;

  if $r == maxc {
    h = ($g - $b) / delta;
  } elif $g == maxc {
    h = 2 + ($b - $r) / delta;
  } else {
    h = 4 + ($r - $g) / delta;
  }

  h = (h / 6.0) % 1.0;
}

#TODO: replace pos and center with 0-1 values, 
proc write text, size, RGBA color, UDim2 pos, Vector2 anchorPoint {
    rgb_to_hsv $color.r / 255, $color.g / 255, $color.b / 255;

    show;
    local trueSize = $size * (ScreenSize.y / 360);

    set_size trueSize * 100;
    local Vector2 screenPos = Vector2{x: 0, y: 0};

    local offset = 0;
    local i = 0;

    local Vector2 textBounds = Vector2{x: 0, y: 0};
    repeat length($text) {
        i++;
        switch_costume $text[i];
        textBounds.x += char_lens[costume_number()] * trueSize;
    }
    textBounds.y = 27 * trueSize;

    screenPos.x = (-ScreenSizeHalf.x) + ($pos.x * ScreenSize.x) + (-textBounds.x * $anchorPoint.x) + $pos.px;
    screenPos.y = ScreenSizeHalf.y + ($pos.y * -ScreenSize.y) + (textBounds.y * -0.5) + (textBounds.y * $anchorPoint.y) - $pos.py;
    i = 0;
    repeat length($text) {
        i++;
        switch_costume $text[i];
        offset += char_lens[costume_number()] * 0.5 * trueSize;
        goto screenPos.x + offset, screenPos.y;
        clear_graphic_effects;
        if s > 0.99 {
            set_color_effect h * 200;
            set_brightness_effect (1 - v) * -100;
            set_ghost_effect (255 - $color.a) / 2.55;
            stamp;
        } elif s < 0.01 and v > 0.99 {
            set_brightness_effect 100;
            set_ghost_effect (255 - $color.a) / 2.55;
            stamp;
        } elif s < 0.01 and v < 0.01 {
            set_brightness_effect -100;
            set_ghost_effect (255 - $color.a) / 2.55;
            stamp;
        } else {
            set_brightness_effect (1 - s) * 100;
            set_color_effect h * 200;
            set_ghost_effect (255 - $color.a) / 2.55;
            stamp;
            if v < 0.99 {
                set_brightness_effect -100;
                set_ghost_effect (v * 100) + ((100 - (v * 100)) * ($color.a / 255));
                stamp;
            }
        }
        offset += char_lens[costume_number()] * 0.5 * trueSize;
    }
    hide;
    switch_costume 1;
}

proc drawText {
    if mapLoaded == false {
        write "LOADING MAP", 1, COLOR(0, 0, 0, 255), UDIM2(0.5, 0, 0.5, 0), VEC2(0.5, 0.5);
        stop_this_script;
    }

    write "FPS: " & FPS, 1, COLOR(0, 0, 0, 50), UDIM2(0.005, 1, 0, 1), Vector2{x: 0, y: 0};
    write "FPS: " & FPS, 1, COLOR(255, 255, 255, 255), UDIM2(0.005, 0, 0, 0), Vector2{x: 0, y: 0};
    
    write "TRI: " & renderedTris, 1, COLOR(0, 0, 0, 50), UDIM2(0.005, 1, 0.06, 1), Vector2{x: 0, y: 0};
    write "TRI: " & renderedTris, 1, COLOR(255, 255, 255, 255), UDIM2(0.005, 0, 0.06, 0), Vector2{x: 0, y: 0};

    write velocityText, 1, COLOR(0, 255, 255, 255), UDIM2(0.5, 0, 0.75, 0), Vector2{x: 0.5, y: 0.5};
}

on "render-text" {
    drawText;
}