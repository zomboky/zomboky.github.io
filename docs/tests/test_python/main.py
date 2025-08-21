import random
from PIL import Image, ImageDraw
import os

def generate_pixel_sky_gif(
    width=200,
    height=150,
    frames=50,
    num_stars=80,
    num_planets=3,
    shooting_rate=0.05,
    shooting_length=20,
    output="sky.gif",
    batch=1
):
    os.makedirs("outputs", exist_ok=True)

    # Palette pour étoiles
    star_palette = [
        (255, 255, 255),
        (255, 240, 200),
        (255, 200, 120),
        (200, 200, 255),
        (180, 255, 230),
        (255, 180, 255)
    ]

    # Palette pour planètes
    planet_palette = [
        (255, 100, 100),
        (100, 255, 100),
        (100, 100, 255),
        (255, 255, 100)
    ]

    for b in range(batch):
        images = []

        # Positions et caractéristiques des étoiles
        star_positions = [(random.randint(0, width - 1), random.randint(0, height - 1)) for _ in range(num_stars)]
        star_colors = [random.choice(star_palette) for _ in range(num_stars)]
        star_shapes = [random.choice(["point", "cross"]) for _ in range(num_stars)]
        star_states = [random.randint(0, 2) for _ in range(num_stars)]

        # Planètes fixes
        planet_positions = [(random.randint(10, width - 10), random.randint(10, height - 10)) for _ in range(num_planets)]
        planet_colors = [random.choice(planet_palette) for _ in range(num_planets)]
        planet_sizes = [random.randint(3, 6) for _ in range(num_planets)]

        # Étoiles filantes actives
        shooting_stars = []

        for frame in range(frames):
            img = Image.new("RGB", (width, height), "black")
            draw = ImageDraw.Draw(img)

            # étoiles fixes scintillantes
            for i, (x, y) in enumerate(star_positions):
                base_color = star_colors[i]
                factor = [0.6, 0.9, 1.0][star_states[i] % 3]
                color = tuple(int(c * factor) for c in base_color)
                if star_shapes[i] == "point":
                    draw.point((x, y), fill=color)
                else:  # croix
                    draw.line((x-1, y, x+1, y), fill=color)
                    draw.line((x, y-1, x, y+1), fill=color)

                if random.random() < 0.3:
                    star_states[i] += 1


            # générer de nouvelles étoiles filantes
            if random.random() < shooting_rate:
                x0 = random.randint(0, width//2)
                y0 = random.randint(0, height//2)
                x1 = random.randint(width//2, width - 1)
                y1 = random.randint(height//2, height - 1)
                shooting_stars.append({
                    "x0": x0, "y0": y0,
                    "x1": x1, "y1": y1,
                    "t": 0,  # position relative
                    "speed": random.uniform(0.03, 0.08)
                })

            # dessiner étoiles filantes
            for star in shooting_stars:
                t = star["t"]
                x = int(star["x0"] + t * (star["x1"] - star["x0"]))
                y = int(star["y0"] + t * (star["y1"] - star["y0"]))

                # traînée linéaire
                trail_length = 6
                for i in range(trail_length):
                    trail_t = t - i * 0.02
                    if trail_t < 0:
                        continue
                    tx = int(star["x0"] + trail_t * (star["x1"] - star["x0"]))
                    ty = int(star["y0"] + trail_t * (star["y1"] - star["y0"]))
                    brightness = max(0, 255 - i * 40)
                    draw.point((tx, ty), fill=(brightness, brightness, 255))

                # mettre à jour position
                star["t"] += star["speed"]

            # retirer étoiles filantes hors écran
            shooting_stars = [s for s in shooting_stars if s["t"] <= 1.2]

            images.append(img)

        filename = f"outputs/{output.replace('.gif','')}_{b+1}.gif"
        images[0].save(filename, save_all=True, append_images=images[1:], duration=100, loop=0)
        print(f"✅ GIF généré : {filename}")


# Exemple d'utilisation
generate_pixel_sky_gif(
    width=1920,
    height=1080,
    frames=300,
    num_stars=600,
    shooting_rate=0.02,
    shooting_length=50,
    output="sky_pixel_art.gif",
    batch=1
)
