# VDP field spec — what a dealer uploads per car (R19)
Target: everything a buyer decision or a match score could depend on. Grouped for the D1 schema.
Current `vdps` has ~18 columns; this is the full target list (30 fields) to migrate toward.

## 1 · Identity (5)
vin · stock_number · year · make · model
## 2 · Trim & configuration (5)
trim · body_style (sedan/SUV/truck/coupe/van/wagon) · doors · seats · upgrade_packages (JSON: premium, tech, tow, cold-weather…)
## 3 · Powertrain (5)
engine · displacement_l · fuel_type (gas/hybrid/PHEV/EV/diesel) · drivetrain (FWD/RWD/AWD/4WD) · transmission
## 4 · EV-specific (3)
battery_kwh · range_epa_mi · charge_speed_kw
## 5 · Condition & history (5)
mileage_exact · condition_grade · title_status (clean/salvage/rebuilt) · owners_count · accident_history
## 6 · Certification & warranty (3)
certified (CPO) · warranty_remaining_mo · service_records
## 7 · Appearance (3)
exterior_color · interior_color · interior_material (cloth/leather/vegan)
## 8 · Money — the match-critical block (6)
price · unit_cost (dealer's cost — drives commission) · price_mo · lot_date (drives aging/holding) ·
market_price_avg · price_vs_market
## 9 · Credit targeting (2)
credit_band (which tier this car is staged for) · min_down
## 10 · Logistics (3)
location_zip · rooftop_id · photos

**Why these:** fields 8 + 9 are what make the dealer KPIs real (commission, store savings, close probability
are currently limited by `unit_cost` / `lot_date` being dealer-entered). Fields 2, 4, and 7 are what buyers
actually filter on. Fields 5 + 6 are the trust signals that move a subprime buyer.
