/** Персонажи ИИ-оппонентов КотоИмперии */

export interface CatCharacter {
  name: string;
  title: string;
  fur: string;      // основной окрас
  furDark: string;  // тёмный окрас (полоски/контуры)
  accent: string;   // акцент (аксессуар)
  eyes: string;
  personality: string;
}

export const AI_CHARACTERS: CatCharacter[] = [
  {
    name: 'Барон Пушистик',
    title: 'аристократ',
    fur: '#8d6e63',
    furDark: '#5d4037',
    accent: '#c9a227',
    eyes: '#2e7d32',
    personality: 'Носит монокль мысленно. Ходит медленно, но с достоинством.',
  },
  {
    name: 'Мурзилка Бандитская',
    title: 'дворовый авторитет',
    fur: '#78909c',
    furDark: '#455a64',
    accent: '#d84315',
    eyes: '#f9a825',
    personality: 'Бывалый. Подкидывает издалека и без предупреждения.',
  },
  {
    name: 'Клеопатра IX',
    title: 'царица',
    fur: '#eceff1',
    furDark: '#b0bec5',
    accent: '#8e24aa',
    eyes: '#26c6da',
    personality: 'Правит клубом уже в девятом поколении. Не прощает слабых заходов.',
  },
  {
    name: 'Сэр Мяусон',
    title: 'рыцарь колоды',
    fur: '#ffb74d',
    furDark: '#e65100',
    accent: '#1565c0',
    eyes: '#43a047',
    personality: 'Честный до кончиков когтей. Бьётся только открыто.',
  },
];

export const DIFFICULTY_NAMES: Record<string, string> = {
  kitten: 'Котёнок',
  alley: 'Дворовый кот',
  master: 'КотоМагистр',
};

export const DIFFICULTY_DESCRIPTIONS: Record<string, string> = {
  kitten: 'Играет наугад, мяукает от счастья, иногда берёт карты просто так.',
  alley: 'Бережёт старшие карты и козыри, избавляется от слабых, считает карты на столе.',
  master: 'Помнит весь отбой, считает вероятности и копит козыри к концовке. Без мошенничества.',
};
