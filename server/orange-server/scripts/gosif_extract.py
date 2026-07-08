#!/usr/bin/env python3
"""Extrait la moyenne GOSIF (SIF) par zone depuis un GeoTIFF global 0.05°.

Usage : gosif_extract.py <fichier.tif> <regions.json>

<regions.json> : liste de { "id": str, "bbox": [minLon, minLat, maxLon, maxLat] }.
Sortie (stdout) : JSON { regionId: valeurMoyenneOuNull } en unités réelles
(W m-2 µm-1 sr-1), après application du scale factor 0.0001 et exclusion des
valeurs de remplissage 32767 (eau) et 32766 (neige/glace permanente) — voir
Fair_Data_Use_Policy_and_Readme_GOSIF_v2.pdf.
"""

import json
import sys

import numpy as np
from osgeo import gdal

gdal.UseExceptions()

SCALE_FACTOR = 0.0001
FILL_VALUES = (32767, 32766)


def region_mean(band_array, geotransform, raster_w, raster_h, bbox):
    origin_lon, pixel_w, _, origin_lat, _, pixel_h = geotransform
    min_lon, min_lat, max_lon, max_lat = bbox

    col_start = int(round((min_lon - origin_lon) / pixel_w))
    col_end = int(round((max_lon - origin_lon) / pixel_w))
    row_start = int(round((max_lat - origin_lat) / pixel_h))
    row_end = int(round((min_lat - origin_lat) / pixel_h))

    col_start = max(0, min(col_start, raster_w))
    col_end = max(0, min(col_end, raster_w))
    row_start = max(0, min(row_start, raster_h))
    row_end = max(0, min(row_end, raster_h))
    if col_end <= col_start or row_end <= row_start:
        return None

    window = band_array[row_start:row_end, col_start:col_end]
    valid = window[~np.isin(window, FILL_VALUES)]
    if valid.size == 0:
        return None
    return float(np.mean(valid)) * SCALE_FACTOR


def main():
    tif_path, regions_path = sys.argv[1], sys.argv[2]
    with open(regions_path, encoding="utf-8") as f:
        regions = json.load(f)

    ds = gdal.Open(tif_path)
    band = ds.GetRasterBand(1)
    array = band.ReadAsArray()
    geotransform = ds.GetGeoTransform()
    raster_w, raster_h = ds.RasterXSize, ds.RasterYSize

    out = {}
    for region in regions:
        out[region["id"]] = region_mean(array, geotransform, raster_w, raster_h, region["bbox"])

    json.dump(out, sys.stdout)


if __name__ == "__main__":
    main()
