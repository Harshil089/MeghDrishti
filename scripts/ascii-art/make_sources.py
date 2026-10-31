import json, numpy as np, matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from scipy.interpolate import griddata
from scipy.spatial import cKDTree
import cv2

ov = [s for s in json.load(open("overview.json"))["data"] if s["latitude"] > 5 and s["longitude"] > 65]
lon = np.array([s["longitude"] for s in ov]); lat = np.array([s["latitude"] for s in ov])

def save(fig, name, stretch=1.2):
    fig.savefig(name, dpi=200, facecolor="white"); plt.close(fig)
    im = cv2.imread(name); h, w = im.shape[:2]
    cv2.imwrite(name, cv2.resize(im, (w, int(h * stretch)), interpolation=cv2.INTER_AREA))  # glyph cells are 1.67:1, img2txt assumes 2:1

def bare(w, h):
    fig = plt.figure(figsize=(w, h)); ax = fig.add_axes([0, 0, 1, 1]); ax.set_axis_off(); return fig, ax

# 1. India drawn by its own weather stations: log station density.
fig, ax = bare(6, 6.6)
from matplotlib.colors import LinearSegmentedColormap
ink = LinearSegmentedColormap.from_list("ink", ["#8a8a8a", "#000000"])
ax.hexbin(lon, lat, gridsize=48, bins="log", cmap=ink, mincnt=1, linewidths=0)
ax.set_xlim(67, 98); ax.set_ylim(6, 37.5); ax.set_aspect("equal")
save(fig, "india_stations.png")

# 2. Live temperature field interpolated between reporting stations, with isotherms.
rep = [s for s in ov if s["temperature_c"] is not None]
px = np.array([s["longitude"] for s in rep]); py = np.array([s["latitude"] for s in rep]); pt = np.array([s["temperature_c"] for s in rep])
gx, gy = np.meshgrid(np.linspace(67, 98, 300), np.linspace(6, 37.5, 300))
gt = griddata((px, py), pt, (gx, gy), method="linear")
far = cKDTree(np.c_[lon, lat]).query(np.c_[gx.ravel(), gy.ravel()])[0].reshape(gx.shape) > 1.1
gt = np.where(far, np.nan, gt)
fig, ax = bare(6, 6.6)
ax.contourf(gx, gy, gt, levels=9, cmap="Greys", alpha=0.85)
ax.contour(gx, gy, gt, levels=9, colors="black", linewidths=1.6)
ax.set_xlim(67, 98); ax.set_ylim(6, 37.5); ax.set_aspect("equal")
save(fig, "india_temperature.png")

# 3. A real station's 48 h temperature trace inside its normal band.
tr = json.load(open("trace.json")); obs = tr["obs"][::-1]
y = np.array([o["measurements"]["temperature_c"] or np.nan for o in obs]); x = np.arange(len(y))
fig, ax = bare(8, 2.2)
m, sd = np.nanmean(y), np.nanstd(y)
ax.fill_between(x, m - sd, m + sd, color="0.88")
ax.plot(x, y, color="black", linewidth=4)
ax.set_xlim(0, len(y) - 1); ax.set_ylim(np.nanmin(y) - 1, np.nanmax(y) + 1)
save(fig, "trace.png")

# 4. Illustrative radar PPI: range rings, crosshair and reflectivity cells.
fig, ax = bare(6, 6)
th = np.linspace(0, 2 * np.pi, 400); rng = np.random.default_rng(7)
yy, xx = np.mgrid[-1:1:400j, -1:1:400j]
refl = sum(a * np.exp(-((xx - cx) ** 2 + (yy - cy) ** 2) / s) for a, cx, cy, s in
           [(1, 0.35, 0.2, 0.04), (0.9, 0.5, 0.35, 0.02), (0.8, -0.3, -0.4, 0.05), (0.7, -0.1, 0.55, 0.015), (0.9, 0.2, -0.5, 0.025)])
refl = refl * (0.75 + 0.25 * rng.random(refl.shape)); refl[xx ** 2 + yy ** 2 > 0.97] = 0
ax.imshow(refl, cmap="Greys", extent=(-1, 1, -1, 1), vmin=0, vmax=0.8)
for r in (0.33, 0.66, 0.97): ax.plot(r * np.cos(th), r * np.sin(th), color="black", linewidth=7)
ax.plot([-1, 1], [0, 0], color="0.2", linewidth=4); ax.plot([0, 0], [-1, 1], color="0.2", linewidth=4)
ax.set_xlim(-1.02, 1.02); ax.set_ylim(-1.02, 1.02); ax.set_aspect("equal")
save(fig, "radar.png")
print("images done")
