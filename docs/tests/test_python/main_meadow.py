import random
import math
from PIL import Image, ImageDraw
import os

def generate_mountain_meadow(
    width=800,
    height=450,
    frames=150,
    num_grass=160,
    num_flowers=25,
    bee_spawn_rate=0.05,
    num_clouds=5,
    output="prairie_montagnes_nuages.gif",
    batch=1
):
    os.makedirs("outputs", exist_ok=True)

    grass_colors = [(34,139,34), (0,128,0), (50,205,50)]
    flower_colors = [(255,100,100), (255,200,0), (200,0,255), (255,105,180)]
    bee_colors = [(255, 220, 0), (0, 0, 0)]

    for b in range(batch):
        images = []

        # --- Herbes ---
        grass_positions = [(random.randint(0, width-1), height-5-random.randint(0,30)) for _ in range(num_grass)]
        grass_heights = [random.randint(12,22) for _ in range(num_grass)]
        grass_colors_choice = [random.choice(grass_colors) for _ in range(num_grass)]
        grass_phase = [random.uniform(0, 2*math.pi) for _ in range(num_grass)]

        # --- Fleurs ---
        flower_positions = [(random.randint(20, width-20), height-30-random.randint(0,40)) for _ in range(num_flowers)]
        flower_colors_choice = [random.choice(flower_colors) for _ in range(num_flowers)]

        # --- Nuages (position et taille) ---
        clouds = []
        for _ in range(num_clouds):
            cx = random.randint(0, width)
            cy = random.randint(30, height//3)
            size = random.randint(40, 80)
            clouds.append({"x": cx, "y": cy, "size": size, "speed": random.uniform(0.3, 0.7)})

        bees = []

        for frame in range(frames):
            # ciel bleu
            img = Image.new("RGB", (width, height), (135, 206, 235))
            draw = ImageDraw.Draw(img)

            # --- Montagnes stylisées ---
            mountain_layers = [
                ((80, 80, 110), height//2 + 80),  # fond
                ((110, 110, 140), height//2 + 40),
                ((150, 150, 180), height//2)
            ]
            for color, base_y in mountain_layers:
                peaks = []
                step = width // 5
                for i in range(6):
                    px = i*step
                    py = base_y - random.randint(50, 120) if frame == 0 else base_y
                    peaks.append((px, py))
                peaks += [(width, height), (0, height)]
                draw.polygon(peaks, fill=color)

            # --- Nuages poussés par le vent ---
            for cloud in clouds:
                # forme = plusieurs ellipses
                for i in range(3):
                    offset_x = i*cloud["size"]//2
                    offset_y = random.randint(-10,10)
                    draw.ellipse((
                        cloud["x"]+offset_x, cloud["y"]+offset_y,
                        cloud["x"]+offset_x+cloud["size"], cloud["y"]+offset_y+cloud["size"]//2
                    ), fill=(245,245,245))
                # mouvement du vent
                cloud["x"] += cloud["speed"]
                if cloud["x"] > width+100:
                    cloud["x"] = -100
                    cloud["y"] = random.randint(20, height//3)

            # --- Herbe ---
            for i, (x, y) in enumerate(grass_positions):
                h = grass_heights[i]
                sway = int(3 * math.sin(frame*0.2 + grass_phase[i]))
                draw.line((x, y, x+sway, y-h), fill=grass_colors_choice[i])

            # --- Fleurs + abeilles ---
            for i, (x, y) in enumerate(flower_positions):
                draw.ellipse((x-3, y-3, x+3, y+3), fill=flower_colors_choice[i])
                draw.line((x, y, x, y+10), fill=(34,139,34))
                # spawn abeille
                if random.random() < bee_spawn_rate:
                    bees.append({
                        "x": x,
                        "y": y,
                        "dx": random.uniform(-2, 2),
                        "dy": random.uniform(-3, -1),
                        "phase": random.uniform(0, 2*math.pi)
                    })

            # --- Abeilles ---
            new_bees = []
            for bee in bees:
                x = bee["x"]
                y = bee["y"] + math.sin(frame*0.3 + bee["phase"])*2
                # corps
                draw.rectangle((x, y, x+6, y+3), fill=bee_colors[0])
                draw.line((x+2, y, x+2, y+3), fill=bee_colors[1])
                draw.line((x+4, y, x+4, y+3), fill=bee_colors[1])
                # ailes
                draw.ellipse((x, y-2, x+2, y), fill=(200,200,255))
                draw.ellipse((x+4, y-2, x+6, y), fill=(200,200,255))

                bee["x"] += bee["dx"]
                bee["y"] += bee["dy"]
                if 0 < bee["x"] < width and 0 < bee["y"] < height:
                    new_bees.append(bee)
            bees = new_bees

            images.append(img)

        filename = f"outputs/{output.replace('.gif','')}_{b+1}.gif"
        images[0].save(filename, save_all=True, append_images=images[1:], duration=100, loop=0)
        print(f"✅ GIF généré : {filename}")


# Exemple d’utilisation
generate_mountain_meadow(
    width=900,
    height=500,
    frames=180,
    num_grass=180,
    num_flowers=28,
    bee_spawn_rate=0.05,
    num_clouds=6,
    output="prairie_montagnes_nuages.gif",
    batch=1
)
