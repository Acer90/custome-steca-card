# Custome Steca Card (Home Assistant)

Custom Lovelace card for visualizing Steca inverter flows with animated power direction, battery SoC, and an optional setup popup.

## Installation

1. Copy the JavaScript file into your Home Assistant `www` directory:
   - Place the file at `config/www/custome_steca_card.js` (or an equivalent path in your setup).
2. Add it as a Lovelace resource:
   - Settings → Dashboards → Resources → Add Resource
   - URL: `/local/custome_steca_card.js`
   - Type: JavaScript Module
3. Reload the browser (clear cache if needed).

## Basic Usage

Add the card to your dashboard and provide at least `mode_entity`:

- type: custom:custome-steca-card
- title: Steca
- mode_entity: sensor.steca_1_modus

## Optional Features

### Setup Popup (Bubble-Card)

If you use Bubble-Card popups, set `setup_popup` to the hash (e.g., `#Steca-Config`).
The setup button is hidden automatically when `setup_popup` is empty.

- setup_popup: "#Steca-Config"

The card uses navigation to open the popup, so this works with Bubble-Card popups that are addressable by hash.

### Power Flow Animation

- Direction:
  - Positive battery power → flow from top to bottom (charging).
  - Negative battery power → flow from bottom to top (discharging).
- Speed and number of dots scale with absolute power.
- Flow dots rebuild only when an animation cycle ends (prevents jumping).

## Configuration Options

| Option | Type | Description |
| --- | --- | --- |
| title | string | Card title (default: `Schema`). |
| mode_entity | string | **Required.** Inverter mode sensor. |
| charge_entity | string | Charge status entity. |
| charge_ac_entity | string | AC charge status entity. |
| charge_solar_entity | string | Solar charge status entity. |
| load_entity | string | Load status entity. |
| pv_power_entity | string | PV power sensor (W). |
| ac_power_entity | string | AC power sensor (W). |
| grid_power_entity | string | Grid power sensor (W). |
| battery_soc_entity | string | Battery SoC sensor (%). |
| battery_ah_entity | string | Battery capacity current (Ah). |
| battery_ah_max_entity | string | Battery capacity max (Ah). |
| battery_power_entity | string | Battery power sensor (W). If not set, power is derived from current and voltage. |
| battery_discharge_entity | string | Battery discharge current (A). |
| battery_charge_entity | string | Battery charge current (A). |
| battery_voltage_lr_entity | string | Battery voltage (LR). |
| battery_voltage_wr_entity | string | Battery voltage (WR). |
| setup_popup | string | Hash for Bubble-Card popup navigation (e.g. `#Steca-Config`). |
| setup_entities | string or string[] | Optional list of entities for setup overlay (legacy). |
| setup_groups | array | Optional grouped setup entities (legacy). |

## Example (Full)

- type: custom:custome-steca-card
- title: Steca
- mode_entity: sensor.steca_1_modus
- pv_power_entity: sensor.steca_1_pv_ladeleistung
- ac_power_entity: sensor.steca_1_ac_wirkleistung
- grid_power_entity: sensor.steca_1_netzleistung
- battery_soc_entity: sensor.steca_1_soc
- battery_ah_entity: sensor.steca_1_batt_ah
- battery_ah_max_entity: sensor.steca_1_batt_ah_max
- battery_charge_entity: sensor.steca_1_batterie_ladestrom
- battery_discharge_entity: sensor.steca_1_batterie_entladestrom
- battery_voltage_wr_entity: sensor.steca_1_batteriespannung_wr
- setup_popup: "#Steca-Config"

## Notes

- The card uses the Home Assistant accent color for highlights and the SoC progress bar.
- Battery power is derived if `battery_power_entity` is not set.

## Support

If the popup does not open, verify that the hash matches the Bubble-Card popup configuration and that the resource is loaded correctly.
