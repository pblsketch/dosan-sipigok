# -*- coding: utf-8 -*-
"""그림 프롬프트(tools/prompts/*.txt)와 목록(tools/manifest.tsv)을 만든다.

    python tools/make_prompts.py

프롬프트는 영어(ASCII)로만 쓴다(gen.ps1이 명령줄로 넘기므로).
그림은 모두 화풍 A(수묵담채 진경산수). 인물은 design/ref/ref_cast.png(인물 설정 그림)를 참조해 모습을 맞춘다.
"""
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = os.path.join(ROOT, 'tools', 'prompts')
os.makedirs(P, exist_ok=True)

STYLE = ('Art style: Korean true-view landscape ink painting (jingyeong sansu) with light watercolor tints (sumuk damchae), '
         'in the manner of 18th-century Korean literati painters: expressive calligraphic brush strokes, dry-brush texture strokes on rocks, '
         'dotted moss on pines, soft transparent washes of pale indigo, light ochre and faint green, generous white space, '
         'visible warm hanji paper texture, elegant and restrained. Absolutely no text, no letters, no calligraphy, no seals, no signatures, no captions.')
PRE = ('A tall vertical panel of a Korean folding-screen painting, Joseon dynasty, year 1565, the countryside of Dosan by the upper Nakdong river. '
       'Keep every important element inside the central 70 percent of the height and make each listed element clearly visible and recognizable, not tiny.')
CAST = ('If the elderly scholar in a white robe with a black soft cap or the ten-year-old boy with one long braid tied with a red ribbon '
        'and a pale jade-green jacket appear, they must look exactly like in the reference image, but they stay small in the landscape.')

SCENES = {
    's00': 'Scene: the courtyard in front of Dosan Seodang, a tiny humble three-bay study hall with a grey tiled roof and a wooden veranda, brushwood fence and gate, pine trees, misty mountains behind. On the veranda the elderly scholar leans on a low wooden armrest, listening peacefully with eyes half closed. In the courtyard below, five or six children in simple hanbok sing together and dance joyfully, waving their long sleeves and stamping their feet; the boy with the braid is among them in the front. Soft spring morning light. Upper part: mountains and sky with light mist.',
    's01': 'Scene: Dosan Seodang in the morning. Middle right: the tiny three-bay study hall with a grey tiled roof among pines on a gentle slope; the elderly scholar sits on its wooden veranda (clearly visible). Lower left, large and clear: a clean spring bubbling out between big mossy rocks, and a small stream running over stones. The boy stands beside the spring looking at the water. Upper part: soft layered mountains in morning mist.',
    's02': 'Scene: dusk at Dosan. Middle left: the tiny study hall under pines. Upper half, large and clear: a wide band of drifting evening mist and rosy sunset glow across layered mountains. Upper right: a pale full moon rising, and a visible breeze bending tall reeds and pine branches below the moon, leaves flying in the wind. At the brushwood gate the elderly scholar stands with a walking stick, the boy beside him, both gazing at the mist and the moon. Lower part: a quiet meadow in soft shadow.',
    's03': 'Scene: a peaceful farming village below Dosan in spring. Lower half, clear: villagers kindly helping one another plant rice in a flooded paddy, and under a big zelkova tree an old man shares food with children (warm, honest country customs). Upper half on the hillside, clear: a long thatched dormitory hall where several young scholars in white robes read books together on the veranda. On the village path a middle-aged villager with a white towel tied around his head gossips with a raised hand; the boy with the braid walks past him, listening.',
    's04': 'Scene: a deep secluded valley near Dosan. Lower left, large and clear: a cluster of wild orchids with delicate pale flowers growing on mossy rocks beside a small stream. Upper middle, large and clear: soft white clouds resting on the mountain peaks. Far in the upper right distance, beyond many layers of mountains and mist toward the north, a faint tiny silhouette of palace roofs, barely visible. The elderly scholar stands on a rock gazing toward that far distance; the boy crouches by the orchids, smelling them.',
    's05': 'Scene: in front of a mountain, a flat rocky terrace (dae) stands on a cliff above a calm river pool. Middle: the terrace with the elderly scholar and the boy sitting on it (clear). Lower half: the water below the terrace, clear and still. Over the water in the middle, a flock of white gulls flying back and forth (clearly visible, many birds). Upper right, on a far riverside road going away toward the distant horizon, a gleaming pure white pony trots away alone (clearly visible, small but bright).',
    's06': 'Scene: spring at Dosan. Upper half, large and clear: mountains covered all over with blossoming pink azaleas and pale apricot flowers, the whole mountainside in bloom. Lower half: a still river pool reflecting white clouds and blue sky light (clear reflections). A fish leaping out of the water in the lower middle, and a black kite (a hawk-like bird of prey with spread wings) soaring high in the sky at the upper left (both clearly visible). IMPORTANT: no paper kites, no toy kites, no flags anywhere in the picture. On the right bank a flat stone terrace by the water. The elderly scholar and the boy stand on the flat rock by the water; the boy points at the leaping fish. Only these two people appear: do not include the herbal doctor or the villager from the reference image, and no other people.',
    's07': 'Scene: a riverside cliff near Dosan Seodang. Upper left, clear: a rocky terrace on the cliff edge above the river, with a small path winding around it and down the slope. Lower right, large and clear: the middle room of the tiny study hall seen through its opened paper doors, clean, bright and neat, filled with many piles of thread-bound books and scrolls on low shelves and on the floor. The elderly scholar sits reading inside; the boy walks down the path carrying a stack of books.',
    's08': 'Scene: a dramatic sky over the mountains near Dosan. Upper left, large and clear: dark thunderclouds and a huge jagged lightning bolt striking and splitting a rocky mountain peak, fragments of rock flying. Upper right, large and clear: a blazing white sun at the top of the sky breaking through the clouds, pouring bright light over the land. Lower part: the tiny study hall among pines, the boy and the elderly scholar standing in the courtyard looking up calmly at the sky.',
    's09': 'Scene: an old mountain path winding upward through pines, rocks and misty ridges. Lower middle, large and clear: well-worn footprints and old stone steps on the path, left by travelers long ago. Far ahead near the top, in the mist, faint translucent silhouettes of three ancient scholars in long robes walking away, ghostly and symbolic (clearly visible but pale). The boy climbs the path following the footprints.',
    's10': 'Scene: a fork in a country road. The right branch is a narrow humble path leading up to the tiny study hall among pines at Dosan (clear). The left branch is a wide road glittering with golden light, running toward a distant grand city gate and palace roofs on the horizon (clear). At the fork stands the elderly scholar, facing the study hall; a trail of his footprints loops out along the glittering road and comes back to the fork.',
    's11': 'Scene: upper half, large and clear: a great evergreen mountain covered with deep blue-green pines, tall and steady. Lower half, large and clear: a river flowing on and on in long curves toward the horizon. The sky shows day and night together: a setting sun low on the left and a rising moon on the right. On the riverbank the elderly scholar and the boy stand watching the water flow.',
    's12': 'Scene: inside the humble middle room of the study hall, doors wide open to the courtyard. Middle right: the elderly scholar with white hair reads intently by a small oil lamp, piles of classic books around him (clearly visible). Through the open doors, lower left: an ordinary farmer in work clothes bows respectfully to his aged parents at a brushwood fence (clearly visible). Through a side window, upper left: branches with plum blossoms on one side and falling red autumn leaves on the other, as if the seasons pass. The boy sits beside the scholar with a book.',
}
# 6곡 가을밤(같은 구도): 봄 그림을 참조로 만든다
AUTUMN = ('The attached reference shows this exact place in spring. Paint the very same place and composition on an autumn night: autumn-colored mountains under a deep blue night sky, '
          'a huge bright full moon hanging just above the flat stone terrace on the right, flooding the terrace with silver moonlight (the terrace glows, clearly visible). '
          'The still pool reflects the moon and thin clouds; a fish leaps and a hawk-like bird of prey glides in the moonlit sky. The elderly scholar sits on the moonlit terrace with the boy beside him; the herbal doctor and the villager must NOT appear, and no other people. Remove any paper kite or toy kite: there must be no paper kites and no flags anywhere. ')

PORTRAITS = {
    'pt_toegye': "Portrait, head and shoulders, of the elderly Confucian scholar-teacher from the reference image (calm gentle face, neat thin white beard, white scholar's robe with black trim, black soft cap), facing slightly to the side with a warm, quiet expression, plain warm paper background.",
    'pt_child': 'Portrait, head and shoulders, of the ten-year-old boy from the reference image (round cheerful face, one long braid tied with a red ribbon, pale jade-green jeogori), smiling with bright curious eyes, plain warm paper background.',
    'pt_doctor': 'Portrait, head and shoulders, of the village herbal doctor from the reference image (black horsehair gat, grey-blue robe), holding up a small bowl of dark herbal medicine with a confident grin, plain warm paper background.',
    'pt_villager': 'Portrait, head and shoulders, of the gossiping villager from the reference image (white towel tied around his head, hemp clothes), whispering a rumor with a raised hand and raised eyebrows, plain warm paper background.',
}

rows = ['# name\tsize\tref\tmode']
for k, v in PORTRAITS.items():
    open(os.path.join(P, k + '.txt'), 'w', encoding='utf-8').write(v + '\n\n' + STYLE + '\n')
    rows.append(f'{k}\t1024x1024\tdesign/ref/ref_cast.png\tsame')
for k, v in SCENES.items():
    open(os.path.join(P, k + '.txt'), 'w', encoding='utf-8').write(PRE + '\n' + v + '\n' + CAST + '\n\n' + STYLE + '\n')
    rows.append(f'{k}\t1024x1536\tdesign/ref/ref_cast.png\tscene')
open(os.path.join(P, 's06b.txt'), 'w', encoding='utf-8').write(PRE + '\n' + AUTUMN + '\n' + CAST + '\n\n' + STYLE + '\n')
open(os.path.join(ROOT, 'tools', 'manifest.tsv'), 'w', encoding='utf-8', newline='\n').write('\n'.join(rows) + '\n')
# 가을 그림은 봄 그림(s06)이 나온 뒤 따로 만든다
open(os.path.join(ROOT, 'tools', 'manifest_b.tsv'), 'w', encoding='utf-8', newline='\n').write('# name\tsize\tref\tmode\ns06b\t1024x1536\tassets/raw/s06.png\tsame\n')
for f in os.listdir(P):
    t = open(os.path.join(P, f), encoding='utf-8').read()
    if any(ord(c) > 127 for c in t):
        print('WARN non-ascii', f)
print(len(rows) - 1, 'prompts')
