# Hair models

The figure maker's hairstyles are small 3D models made by other artists, refitted to the toy figure's round head. Each style is three or four files:

- `hN.bin`: the shape, packed small (positions, texture places, normals and triangles, header `NHR1`).
- `hN.jpg`: the hair texture in greys. The maker tints it to the picked hair colour.
- `hN-n.jpg`: the surface detail (normal map), only for styles that came with one.

`thumbs.jpg` holds the little pictures on the Hairstyle buttons (Bald, then 1 to 27).

## Where each style comes from

| Style | Source file | Note |
| --- | --- | --- |
| Hairstyle 1 (`h1`) | Mozilla Hubs hackweek avatar kit, `hubs-avatars/hackweek-avatar-kit/GLB/hair_bob-1-brown.glb` | |
| Hairstyle 2 (`h2`) | Decentraland avatar assets, `assets/base-avatars/hair/F_Hair_Oldie_02/Hair_Oldie_02.glb` | |
| Hairstyle 3 (`h3`) | Mozilla Hubs hackweek avatar kit, `hubs-avatars/hackweek-avatar-kit/GLB/hair_parted-long-1-brown.glb` | |
| Hairstyle 4 (`h4`) | Decentraland avatar assets, `assets/base-avatars/hair/F_Hair_Anime_03/Hair_Anime_Long.glb` | Back hair shortened to fit the toy (length 0.45). |
| Hairstyle 5 (`h5`) | Decentraland avatar assets, `assets/base-avatars/hair/M_Hair_Keanu/Hair_Keanu.glb` | |
| Hairstyle 6 (`h6`) | Mozilla Hubs hackweek avatar kit, `hubs-avatars/hackweek-avatar-kit/GLB/hair_pony-tail-1-brown.glb` | |
| Hairstyle 7 (`h7`) | Mozilla Hubs hackweek avatar kit, `hubs-avatars/hackweek-avatar-kit/GLB/hair_pony-tail-2-brown.glb` | |
| Hairstyle 8 (`h8`) | Decentraland avatar assets, `assets/base-avatars/hair/F_Hair_PonyTail/Hair_PonyTail.glb` | Back hair shortened to fit the toy (length 0.5). |
| Hairstyle 9 (`h9`) | Mozilla Hubs hackweek avatar kit, `hubs-avatars/hackweek-avatar-kit/GLB/hair_french-braids-double-brown.glb` | |
| Hairstyle 10 (`h10`) | Mozilla Hubs hackweek avatar kit, `hubs-avatars/hackweek-avatar-kit/GLB/hair_pigtails-1-brown.glb` | |
| Hairstyle 11 (`h11`) | Decentraland avatar assets, `assets/base-avatars/hair/F_Hair_TwoTails/Hair_TwoTails.glb` | |
| Hairstyle 12 (`h12`) | Decentraland avatar assets, `assets/base-avatars/hair/M_Hair_SemiAfro_01/Hair_SemiAfro_01.glb` | |
| Hairstyle 13 (`h13`) | Decentraland avatar assets, `assets/base-avatars/hair/M_Hair_Oldie_01/Hair_Oldie_01.glb` | |
| Hairstyle 14 (`h14`) | Mozilla Hubs hackweek avatar kit, `hubs-avatars/hackweek-avatar-kit/GLB/hair_mullet-1-brown.glb` | |
| Hairstyle 15 (`h15`) | Mozilla Hubs hackweek avatar kit, `hubs-avatars/hackweek-avatar-kit/GLB/hair_mohawk-1-brown.glb` | |
| Hairstyle 16 (`h16`) | Decentraland avatar assets, `assets/base-avatars/hair/F_Hair_Punk/Hair_Punk.glb` | |
| Hairstyle 17 (`h17`) | Mozilla Hubs hackweek avatar kit, `hubs-avatars/hackweek-avatar-kit/GLB/hair_fauxhawk-1-brown.glb` | |
| Hairstyle 18 (`h18`) | Mozilla Hubs hackweek avatar kit, `hubs-avatars/hackweek-avatar-kit/GLB/hair_spikey-1-brown.glb` | |
| Hairstyle 19 (`h19`) | Mozilla Hubs hackweek avatar kit, `hubs-avatars/hackweek-avatar-kit/GLB/hair_parted-1-brown.glb` | |
| Hairstyle 20 (`h20`) | Decentraland avatar assets, `assets/base-avatars/hair/M_Hair_TallFront_01/Hair_TallFront.glb` | |
| Hairstyle 21 (`h21`) | Decentraland avatar assets, `assets/base-avatars/hair/M_Hair_Standard_02/Hair_Standard_02.glb` | |
| Hairstyle 22 (`h22`) | Decentraland avatar assets, `assets/base-avatars/hair/F_Hair_CoolStyle/Hair_CoolShortStyle.glb` | |
| Hairstyle 23 (`h23`) | Mozilla Hubs hackweek avatar kit, `hubs-avatars/hackweek-avatar-kit/GLB/hair_short-wave-1-brown.glb` | |
| Hairstyle 24 (`h24`) | Decentraland avatar assets, `assets/base-avatars/hair/M_Hair_Standard_00/Hair_relaxed_hair.glb` | |
| Hairstyle 25 (`h25`) | Decentraland avatar assets, `assets/base-avatars/hair/F_Hair_Bun/Hair_Bun.glb` | |
| Hairstyle 26 (`h26`) | Decentraland avatar assets, `assets/base-avatars/hair/F_Hair_DoubleBun/Hair_DoubleBun.glb` | |
| Hairstyle 27 (`h27`) | Mozilla Hubs hackweek avatar kit, `hubs-avatars/hackweek-avatar-kit/GLB/hair_french-braid-buns-brown.glb` | |

### Sources and licences

- **Mozilla Hubs hackweek avatar kit**, from [Hubs-Foundation/hubs-blender-files](https://github.com/Hubs-Foundation/hubs-blender-files) (`hubs-avatars/hackweek-avatar-kit`). Released under **CC0 1.0** (public domain), per that repository's root `LICENSE`.
- **Decentraland avatar assets**, from [decentraland/avatar-assets](https://github.com/decentraland/avatar-assets). Copyright 2019 Metaverse Holdings Ltd. Licensed under the **Apache License, Version 2.0**; a copy is in [`LICENSE-Apache-2.0.txt`](LICENSE-Apache-2.0.txt).

### What was changed

Every model here was changed from the original for Norne:

- Skinned meshes were baked into their rest pose and moved, reshaped and scaled to sit on the toy figure's round head (each point keeps its height above the original scalp).
- Some back hair was shortened (see the notes above).
- The texture was turned to greys and shrunk to 512 pixels so the maker can colour it.
- The shape was packed into the small `NHR1` format above.
