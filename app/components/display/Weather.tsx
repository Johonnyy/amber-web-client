"use client";

import type { WeatherPayload } from "@/lib/displayTypes";
import { FieldRow } from "@/app/components/display/primitives";

/** A weather panel: hero current conditions + stats + a forecast strip. */
export function Weather({ payload }: { payload: WeatherPayload }) {
  const cur = payload.current;
  const forecast = payload.forecast || [];
  const stats = payload.stats || [];
  return (
    <div className="d-block d-weather">
      <div className="d-weather-hero">
        {cur?.emoji && <span className="d-weather-emoji">{cur.emoji}</span>}
        <div className="d-weather-now">
          {cur?.temp && <span className="d-weather-temp">{cur.temp}</span>}
          <span className="d-weather-loc">{payload.location}</span>
          {cur?.condition && <span className="d-weather-cond">{cur.condition}</span>}
          {cur?.feelsLike && <span className="d-weather-feels">Feels like {cur.feelsLike}</span>}
        </div>
      </div>

      {stats.length > 0 && (
        <div className="d-fields d-weather-stats">
          {stats.map((f, i) => (
            <FieldRow field={f} key={i} />
          ))}
        </div>
      )}

      {forecast.length > 0 && (
        <div className="d-forecast">
          {forecast.map((d, i) => (
            <div className="d-forecast-day" key={i}>
              <span className="d-forecast-label">{d.label}</span>
              {d.emoji && <span className="d-forecast-emoji">{d.emoji}</span>}
              <span className="d-forecast-temps">
                <span className="d-forecast-hi">{d.high}</span>
                {d.low && <span className="d-forecast-lo">{d.low}</span>}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
