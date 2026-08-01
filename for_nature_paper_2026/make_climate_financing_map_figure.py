"""Multi-panel world choropleth of requisite climate financing.

Reproduces the layout of reference.png (grid of small world maps, discrete
colour bins, one horizontal swatch legend per column).

Values are the same `costDict` that js/climate_financing_map.js computes:
a discounted sum of the yearly costs over [NGFS_PEG_YEAR + 1, YEAR_END],
either in billion dollars or as a percentage of 2020 GDP.

Inputs (all already in the repo):
  public/website_sensitivity_climate_financing_coal_export_over_battery.json
  public/countries-110m.json
  js/all_countries_gdp_marketcap_2020_data.js
  js/iso-3166-data.js

Only numpy + matplotlib are required (topojson is decoded by hand).
"""

import json
import string

import matplotlib.pyplot as plt
import numpy as np
from matplotlib.colors import BoundaryNorm, ListedColormap
from matplotlib.patches import Polygon as MplPolygon
from matplotlib.collections import PatchCollection

# ---------------------------------------------------------------- parameters

DATA_JSON = "public/website_sensitivity_climate_financing_coal_export_over_battery.json"
TOPO_JSON = "public/countries-110m.json"
GDP_JS = "js/all_countries_gdp_marketcap_2020_data.js"
ISO_JS = "js/iso-3166-data.js"

NGFS_PEG_YEAR = 2023
DATA_START_YEAR = 2022  # index 0 of each country's yearly array

DISCOUNT_RATE_MAP = {
    "0%": 0.0,
    "2.8% (WACC)": 0.02795381840850683,
    "5%": 0.05,
    "8%": 0.08,
}

# Short labels for the row headers, keyed by the text used in the data files.
DISCOUNT_RATE_LABEL = {
    "0%": "0%",
    "2.8% (WACC)": "2.8%",
    "5%": "5%",
    "8%": "8%",
}

ABSOLUTE_UNIT = True  # True -> billion USD, False -> % of GDP (like the reference)

LEARNING_CURVE = "Learning (investment cost drop because of learning)"
LIFETIME = "30"
COAL_REPLACEMENT = "50% solar, 25% wind onshore, 25% wind offshore"

# Rows of each grid: one discount rate each.
ROWS = list(DISCOUNT_RATE_MAP)

# One figure per energy storage assumption, written to its own file.
FIGURES = [
    ("Not included", "plots/climate_financing_map_no_storage.png"),
    ("Short-term + long-term storage", "plots/climate_financing_map_storage.png"),
]

# Columns of the grid: one time horizon each, with its own colour family and
# legend (mirrors the per-column legends in reference.png).
COLUMNS = [
    (2030, "Blues"),
    (2050, "Oranges"),
    (2070, "Greens"),
    (2100, "PuRd"),
]

# Colour binning follows js/climate_financing_map.js: a d3.scaleThreshold with
# six evenly spaced thresholds from the minimum to the maximum of the data, and
# a seven-class ColorBrewer ramp. The outer two bins are open-ended.
N_BINS = 7
N_THRESHOLDS = N_BINS - 1

PROJECTION = "robinson"  # "robinson" or "mercator"

NO_DATA_COLOR = "#f2f2f2"
BORDER_COLOR = "#9a9a9a"
BORDER_WIDTH = 0.25


# ------------------------------------------------------------------- loading


def load_js_object(path, prefix):
    """Pull the JSON literal out of an `export const <name> = <literal>` file."""
    with open(path) as f:
        text = f.read()
    literal = text.split(prefix, 1)[1].strip().rstrip(";").strip()
    # The bare NaN in gdpMarketcap2020 is fine: json.loads accepts it as a token.
    return json.loads(literal)


def load_iso_number_to_alpha2():
    iso3166 = load_js_object(ISO_JS, "export const iso3166 =")
    return {el["country-code"]: el["alpha-2"] for el in iso3166}


def load_gdp():
    return load_js_object(GDP_JS, "export const gdpMarketcap2020 =")


# ----------------------------------------------------------- cost computation


def calculate_discounted_sum(arr, discount_rate, year_start):
    total = 0.0
    for offset, value in enumerate(arr):
        delta_t = (year_start + offset) - DATA_START_YEAR
        total += value * (1 + discount_rate) ** -delta_t
    return total


def arbitrage_period(year_end):
    return 1 + (year_end - (NGFS_PEG_YEAR + 1))


def calculate_cost_dict(data, key, discount_rate_text, year_end, absolute_unit, gdp):
    """Port of calculateCostDict() in js/climate_financing_map.js."""
    discount_rate = DISCOUNT_RATE_MAP[discount_rate_text]
    yearly_costs_dict = data[key]
    year_start = NGFS_PEG_YEAR + 1
    cost_dict = {}
    for country, yearly in yearly_costs_dict.items():
        window = yearly[year_start - DATA_START_YEAR : year_end - DATA_START_YEAR + 1]
        # x1e3 converts trillion dollars to billion dollars
        summed = calculate_discounted_sum(window, discount_rate, year_start) * 1e3
        if not absolute_unit:
            # /1e9 converts GDP to billion dollars
            country_gdp = gdp.get(country, float("nan"))
            denominator = country_gdp / 1e9 * arbitrage_period(year_end)
            summed = summed / denominator * 100 if denominator else float("nan")
        cost_dict[country] = summed
    return cost_dict


def make_key(learning_curve, lifetime, coal_replacement, energy_storage):
    return "_".join([learning_curve, lifetime, coal_replacement, energy_storage])


# -------------------------------------------------------------- topojson/geo


def decode_topology(topo, object_name):
    """Return {country_numeric_id: [ring_as_(n,2)_lonlat_array, ...]}."""
    scale = topo["transform"]["scale"]
    translate = topo["transform"]["translate"]

    arcs = []
    for arc in topo["arcs"]:
        x = y = 0
        points = []
        for dx, dy in arc:
            x += dx
            y += dy
            points.append((x * scale[0] + translate[0], y * scale[1] + translate[1]))
        arcs.append(np.array(points))

    def ring_coords(arc_indices):
        pieces = []
        for index in arc_indices:
            if index < 0:
                pieces.append(arcs[~index][::-1])
            else:
                pieces.append(arcs[index])
        return np.concatenate(pieces)

    shapes = {}
    for geometry in topo["objects"][object_name]["geometries"]:
        gtype = geometry.get("type")
        if gtype == "Polygon":
            polygons = [geometry["arcs"]]
        elif gtype == "MultiPolygon":
            polygons = geometry["arcs"]
        else:
            continue
        # A few geometries (e.g. disputed territories) carry no country code.
        if "id" not in geometry:
            continue
        rings = [ring_coords(ring) for polygon in polygons for ring in polygon]
        shapes[geometry["id"]] = rings
    return shapes


# Robinson projection tables (Snyder), sampled every 5 degrees of latitude.
_ROBINSON_X = [
    1.0000, 0.9986, 0.9954, 0.9900, 0.9822, 0.9730, 0.9600, 0.9427, 0.9216,
    0.8962, 0.8679, 0.8350, 0.7986, 0.7597, 0.7186, 0.6732, 0.6213, 0.5722,
    0.5322,
]
_ROBINSON_Y = [
    0.0000, 0.0620, 0.1240, 0.1860, 0.2480, 0.3100, 0.3720, 0.4340, 0.4958,
    0.5571, 0.6176, 0.6769, 0.7346, 0.7903, 0.8435, 0.8936, 0.9394, 0.9761,
    1.0000,
]


def clip_to_lon_range(ring, low=-180.0, high=180.0):
    """Sutherland-Hodgman clip of a ring against the two bounding meridians."""
    for bound, keep_above in ((low, True), (high, False)):

        def inside(point):
            return point[0] >= bound if keep_above else point[0] <= bound

        clipped = []
        for i in range(len(ring)):
            current, previous = ring[i], ring[i - 1]
            if inside(current):
                if not inside(previous):
                    clipped.append(_meridian_crossing(previous, current, bound))
                clipped.append(current)
            elif inside(previous):
                clipped.append(_meridian_crossing(previous, current, bound))
        if not clipped:
            return None
        ring = np.array(clipped)
    return ring if len(ring) >= 3 else None


def _meridian_crossing(previous, current, bound):
    span = current[0] - previous[0]
    t = 0.0 if span == 0 else (bound - previous[0]) / span
    return np.array([bound, previous[1] + t * (current[1] - previous[1])])


def unwrap_ring(ring):
    """Yield drawable pieces of a ring, handling antimeridian crossings.

    Fiji and Russia each have a ring with a +-360 degree jump in longitude,
    which would otherwise be drawn as a band straight across the map. Undo the
    jump so the ring is continuous, then emit the copies shifted by one full
    turn, each clipped to the [-180, 180] span of the map.
    """
    lon, lat = ring[:, 0], ring[:, 1]
    if np.abs(np.diff(lon)).max(initial=0.0) <= 180:
        return [ring]
    lon = np.degrees(np.unwrap(np.radians(lon)))
    pieces = []
    for shift in (-360.0, 0.0, 360.0):
        piece = clip_to_lon_range(np.column_stack([lon + shift, lat]))
        # A copy that lies wholly outside collapses onto a meridian; drop it.
        if piece is not None and np.ptp(piece[:, 0]) > 1e-9:
            pieces.append(piece)
    return pieces


def project(lonlat, kind):
    lon = np.asarray(lonlat)[:, 0]
    lat = np.asarray(lonlat)[:, 1]
    if kind == "mercator":
        lat = np.clip(lat, -85.0, 85.0)
        x = np.radians(lon)
        y = np.log(np.tan(np.pi / 4 + np.radians(lat) / 2))
        return np.column_stack([x, y])
    if kind == "robinson":
        grid = np.arange(0, 91, 5)
        alat = np.abs(lat)
        xf = np.interp(alat, grid, _ROBINSON_X)
        yf = np.interp(alat, grid, _ROBINSON_Y)
        x = 0.8487 * xf * np.radians(lon)
        y = 1.3523 * yf * np.sign(lat)
        return np.column_stack([x, y])
    raise ValueError(f"unknown projection: {kind}")


# ----------------------------------------------------------------- rendering


def discrete_cmap(name, n_bins):
    """Evenly spaced swatches from a matplotlib sequential colormap.

    Matplotlib's sequential maps are the continuous versions of the ColorBrewer
    ramps that d3.scheme<Name>[n] samples, so binning one gives the same colour
    family as the website's legend.
    """
    base = plt.get_cmap(name)
    return ListedColormap([base((i + 0.5) / n_bins) for i in range(n_bins)])


def panel_labels():
    """a, b, ... z, aa, ab, ... -- the grid now has more than 26 panels."""
    alphabet = string.ascii_lowercase
    width = 1
    while True:
        for index in range(len(alphabet) ** width):
            label = ""
            for _ in range(width):
                index, remainder = divmod(index, len(alphabet))
                label = alphabet[remainder] + label
            yield label
        width += 1


def draw_map(ax, shapes, iso_number_to_alpha2, cost_dict, cmap, norm):
    patches, colors = [], []
    for numeric_id, rings in shapes.items():
        if numeric_id == "010":  # Antarctica, as in the JS version
            continue
        alpha2 = iso_number_to_alpha2.get(numeric_id)
        value = cost_dict.get(alpha2, float("nan")) if alpha2 else float("nan")
        color = NO_DATA_COLOR if not np.isfinite(value) else cmap(norm(value))
        for ring in rings:
            for piece in unwrap_ring(ring):
                patches.append(MplPolygon(project(piece, PROJECTION), closed=True))
                colors.append(color)
    collection = PatchCollection(
        patches,
        facecolor=colors,
        edgecolor=BORDER_COLOR,
        linewidth=BORDER_WIDTH,
    )
    ax.add_collection(collection)
    collection.set_clip_path(ax.patch)
    ax.autoscale_view()
    ax.set_aspect("equal")
    ax.set_xlim(-2.8, 2.8)
    # Antarctica is dropped, so crop just below the southern tips of the
    # inhabited continents instead of running down to the pole.
    ax.set_ylim(-1.02, 1.36)
    ax.set_axis_off()


def draw_legend(ax, cmap, thresholds, unit_label, caption):
    """Row of discrete swatches with min/max labels, as in reference.png."""
    ax.set_axis_off()
    n = cmap.N
    width = 1.0 / n
    for i in range(n):
        ax.add_patch(
            plt.Rectangle(
                (i * width, 0.45),
                width,
                0.32,
                transform=ax.transAxes,
                facecolor=cmap(i),
                edgecolor="white",
                linewidth=0.6,
                clip_on=False,
            )
        )
    fmt = "{:,.1f}"
    # The costs are in billion dollars; the legend reads better in trillions.
    scale = 1e3 if ABSOLUTE_UNIT else 1.0
    ax.text(
        -0.03, 0.61, (fmt + unit_label).format(thresholds[0] / scale),
        transform=ax.transAxes, ha="right", va="center", fontsize=8,
    )
    ax.text(
        1.03, 0.61, (fmt + unit_label).format(thresholds[-1] / scale),
        transform=ax.transAxes, ha="left", va="center", fontsize=8,
    )
    ax.text(
        0.5, 0.05, caption,
        transform=ax.transAxes, ha="center", va="center", fontsize=9,
    )


def compute_panels(data, gdp, energy_storage):
    """{(row, col): cost_dict} for one energy storage assumption."""
    key = make_key(LEARNING_CURVE, LIFETIME, COAL_REPLACEMENT, energy_storage)
    return {
        (row, col): calculate_cost_dict(
            data, key, discount_rate, year_end, ABSOLUTE_UNIT, gdp
        )
        for row, discount_rate in enumerate(ROWS)
        for col, (year_end, _) in enumerate(COLUMNS)
    }


def compute_column_scales(all_panels):
    """One colour scale per column, pooled over every figure so the two files
    stay directly comparable."""
    column_scales = []
    for col, (_, cmap_name) in enumerate(COLUMNS):
        values = [
            v
            for panels in all_panels
            for row in range(len(ROWS))
            for v in panels[(row, col)].values()
            if np.isfinite(v)
        ]
        low, high = (min(values), max(values)) if values else (0.0, 1.0)
        if high <= low:
            high = low + 1.0
        thresholds = np.linspace(low, high, N_THRESHOLDS)
        # BoundaryNorm needs one more edge than colours; the two outer edges
        # stand in for the open-ended bins of the threshold scale, and clip=True
        # sends anything beyond them into the first/last colour.
        step = thresholds[1] - thresholds[0]
        boundaries = np.concatenate(
            [[thresholds[0] - step], thresholds, [thresholds[-1] + step]]
        )
        cmap = discrete_cmap(cmap_name, N_BINS)
        column_scales.append(
            (cmap, BoundaryNorm(boundaries, cmap.N, clip=True), thresholds)
        )
    return column_scales


def draw_figure(panels, column_scales, shapes, iso_number_to_alpha2, output):
    n_rows, n_cols = len(ROWS), len(COLUMNS)
    fig = plt.figure(figsize=(4.1 * n_cols, 1.9 * n_rows + 0.9))
    grid = fig.add_gridspec(
        n_rows + 1,
        n_cols,
        height_ratios=[1] * n_rows + [0.42],
        hspace=0.04,
        wspace=0.03,
        left=0.085,
        right=0.99,
        top=0.97,
        bottom=0.04,
    )

    unit_label = " tn" if ABSOLUTE_UNIT else "%"
    letters = panel_labels()
    for row, discount_rate in enumerate(ROWS):
        for col, (year_end, _) in enumerate(COLUMNS):
            ax = fig.add_subplot(grid[row, col])
            cmap, norm, _ = column_scales[col]
            draw_map(ax, shapes, iso_number_to_alpha2, panels[(row, col)], cmap, norm)
            ax.text(
                0.005, 0.98, next(letters),
                transform=ax.transAxes, ha="left", va="top",
                fontsize=14, fontweight="bold",
            )
            if row == 0:
                ax.set_title(f"{year_end}", fontsize=10, pad=4)
            if col == 0:
                label = DISCOUNT_RATE_LABEL.get(discount_rate, discount_rate)
                ax.text(
                    -0.02, 0.5, label,
                    transform=ax.transAxes, ha="right", va="center", fontsize=9,
                )

    caption = "Requisite climate financing"
    caption += " (trillion USD)" if ABSOLUTE_UNIT else " (% of GDP)"
    for col in range(n_cols):
        ax = fig.add_subplot(grid[n_rows, col])
        cmap, _, thresholds = column_scales[col]
        # Inset the legend so it sits under the middle of the map above it.
        box = ax.get_position()
        ax.set_position(
            [box.x0 + box.width * 0.18, box.y0, box.width * 0.64, box.height]
        )
        draw_legend(ax, cmap, thresholds, unit_label, caption)

    fig.savefig(output, dpi=300, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    print(f"wrote {output}")


def main():
    with open(DATA_JSON) as f:
        data = json.load(f)
    with open(TOPO_JSON) as f:
        topo = json.load(f)

    shapes = decode_topology(topo, "countries")
    iso_number_to_alpha2 = load_iso_number_to_alpha2()
    gdp = load_gdp()

    # Compute every panel of both figures first, so the columns can share one
    # colour scale across the two files.
    all_panels = [
        compute_panels(data, gdp, energy_storage) for energy_storage, _ in FIGURES
    ]
    column_scales = compute_column_scales(all_panels)

    for panels, (_, output) in zip(all_panels, FIGURES):
        draw_figure(panels, column_scales, shapes, iso_number_to_alpha2, output)


if __name__ == "__main__":
    main()
