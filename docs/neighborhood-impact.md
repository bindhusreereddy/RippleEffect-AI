# Action-specific neighborhood screening

The right-hand impact panel includes People & access and Construction & services, collapsed by default. They complement the existing nature and stormwater estimates. Their purpose is to expose relevant planning questions and mapped footprint intersections, not to generate unsupported predictions.

## Action intent

The scenario preset sets `project_action` (road_widening, building_construction, parking_lot, green_restoration). Supported text commands return a project action for explicit road/building/paving/restoration changes. Manual cell editing preserves the selected intent. In Construction & services, Action under review can override it or use automatic inference. Paving alone is never interpreted as proof of road widening or a lane count. When no cells differ from baseline, no action-specific concern list is generated.

## Three evidence levels

- Estimated from model cells: distinct area with an actual surface change, roof area and paving area in those changed cells. These are nominal footprint areas, not floor area, parking capacity or lane geometry.
- Mapped overlap screening: spatial intersections with retrieved feature geometry. These are map objects/segments, not people, households, actual disruptions or demolition findings.
- Potential concern / Needs information: action-specific prompts about access, crossings, construction phasing, excavation, dust/noise, water/sewer/electricity and other relevant inputs. No quantitative value is fabricated for them.

Road widening specifically mentions crossing/walking/cycling design, property/transit access, traffic information, work zones and buried services. Building construction mentions entrances, use/occupancy-dependent demand, height-dependent shade/privacy, foundations, utilities and material/construction information. Parking mentions entrances, pedestrian movement, capacity layout and drainage/maintenance. Green restoration includes route continuity, planting suitability and underground services.

Reference sources:

- FHWA project planning: https://fhwaapps.fhwa.dot.gov/planworks/Applications/Show/bicycles-and-pedestrians
- EPA construction/sediment: https://www.epa.gov/eg/construction-and-development-effluent-guidelines
- FHWA construction noise: https://www.fhwa.dot.gov/Environment/noise/construction_noise/handbook/handbook03.cfm

## Optional mapped features

Load mapped roads & nearby features explicitly posts the current local context ID to `/location/features`. No external query is made on every edit. It sends a bounded study-area envelope, plus about 60m margin, to public map services. Only loaded real-location contexts are supported; demo grids are not treated as surveyed geography.

The first provider is public Overpass (OpenStreetMap). It requests roads, paths, buildings, entrances, crossings and transit platforms, using bounded timeout/memory, at most one active import and a bounded response size. Nodes and ways are normalized; unsupported geometries and missing multipolygons are disclosed. OpenStreetMap attribution and links are preserved. Partial Overpass error responses are rejected.

If Overpass is unavailable, USGS National Transportation Dataset road centerlines and trails are queried as GeoJSON. The fallback does not provide building, entrance, crossing or urban-sidewalk coverage. Unsupported category counts remain null, never zero. The actual categories, provider and underlying source descriptions are shown. The public Gainesville test returned 13 road features, with underlying source description `2019 April MAF/TIGER`; a recent service retrieval date is not a recent survey date. The OSM editing API is not used as a runtime read-only fallback.

USGS source: https://carto.nationalmap.gov/arcgis/rest/services/transportation/MapServer
Overpass fair-use documentation: https://dev.overpass-api.de/overpass-doc/en/preface/commons.html
OSM attribution: https://www.openstreetmap.org/copyright

Successful feature loads are cached in the existing bounded, in-memory location context (up to 24h). Failed lookups leave unknown counts, with a short cooldown before retrying. No API credentials, paid account, or new runtime package is required.

## Geometry and limits

Footprint rectangles match the same grid geometry used on the map. Line/rectangle intersection uses segment clipping, not just overlapping bounding boxes. Building rings support containment as well as edge intersection. Features intersecting several cells are counted once per feature ID. Geometry is projected to a local meter approximation for distance screening. A feature not intersecting any changed cell but at most approximately 50m away is listed as nearby context. This 50m distance is a lookup convention, not a noise, safety, exposure or impact radius.

Mapped overlays can be toggled on the map. They do not capture mouse events, so clicking and deselecting model cells still works. Orange lines are roads; purple/pink represents other mapped features. Attribution follows the provider.

A count of zero never proves no real conflict: community/government mapping can be incomplete, roads are centerlines without surface width, and model cells are not surveyed construction boundaries. No routing/connectivity, traffic simulation, pedestrian safety finding, noise exposure, shadow map, floor area, parking count, utility capacity or affected-population estimate is computed. Existing layout alternatives are ranked on nature and runoff; access must be checked separately after moving a footprint.
