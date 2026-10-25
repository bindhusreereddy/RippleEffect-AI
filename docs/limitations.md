# RippleEffect AI — Scientific Assumptions & Limitations

## Scientific Transparency & Scope Boundaries

RippleEffect AI is an **evidence-aware decision simulator** designed to facilitate pre-development scenario comparison and stakeholder communication. It is **not** a regulatory permitting seal, certified hydraulic engineering model, or flood depth forecast.

---

## 1. Hydrologic & Hydraulic Limitations

### 1.1 Rational Method Runoff Volume
- **Formula:** $Q = \left(\frac{\text{rainfall\_mm}}{1000}\right) \times \text{cell\_area\_m2} \times C$
- **Assumption:** Assumes steady-state, spatially uniform precipitation across the study area with linear volumetric response.
- **Limitation:** Does not account for time-varying hydrographs (e.g. SCS Unit Hydrograph), dynamic infiltration decay (Horton / Green-Ampt), or groundwater table saturation effects.

### 1.2 D8 Downhill Gravity Routing
- **Method:** Evaluates the 8 adjacent neighboring cells and routes 100% of local flow to the cell with the steepest descent slope gradient.
- **Limitation:** Does not simulate pipe storm sewer networks, pressurized culverts, pump stations, or 2D shallow-water wave backwater effects. Sinks and depressions retain water numerically rather than simulating dynamic overtopping.

---

## 2. Google Groundsource 2026 Dataset Caveats

### 2.1 News Ingestion & Reporting Density Bias
- **Nature of Data:** Google Groundsource extracts flood records from unstructured global and local news articles using Gemini multimodal reasoning.
- **Bias:** Urban thoroughfares, commercial shopping centers, and prominent roadway underpasses receive substantially higher news coverage than rural or low-traffic residential areas. Absence of news reports in a neighborhood does **not** signify absence of flood risk.

### 2.2 Empirical Evidence vs. Hydraulic Depth
- Groundsource provides **empirical historical evidence** that a flooding incident caused disruptions (vehicle stalls, trail closures, property damage).
- It is **not** a calibrated numerical water depth map (e.g. HEC-RAS 2D or SWMM) and cannot predict centimeter-level parcel inundation.

---

## 3. Decision Support vs. Professional Engineering
- **Intended Use:** Rapid scenario exploration, community engagement, site alternative ranking, and preliminary green-infrastructure sizing.
- **Prohibited Claims:** RippleEffect AI must never be cited as a guarantee that a specific address will or will not flood, nor used to substitute for licensed Professional Engineer (PE) stormwater management permits.
