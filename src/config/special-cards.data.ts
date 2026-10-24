import { SpecialCardTemplate } from '../common/interfaces';
import { SpecialCardTiming, SpecialCardType, TraitCategory } from '../common/enums';

/**
 * "Особливі умови" deck, modelled on the tabletop game's special-condition
 * cards. Each player is dealt SPECIAL_CARDS_PER_PLAYER distinct templates at
 * game start; at least one of them is always playable outside voting so
 * nobody is stuck holding only vote-time cards.
 */
const ANY = SpecialCardTiming.ANY;
const VOTING = SpecialCardTiming.VOTING;

export const SPECIAL_CARD_TEMPLATES: SpecialCardTemplate[] = [
  {
    type: SpecialCardType.SWAP_TRAIT,
    category: TraitCategory.PROFESSION,
    title: 'Обмін професіями',
    description: 'Поміняйтеся професією з обраним гравцем.',
    timing: ANY,
    target: 'other',
  },
  {
    type: SpecialCardType.SWAP_TRAIT,
    category: TraitCategory.HEALTH,
    title: "Обмін здоров'ям",
    description: "Поміняйтеся картою здоров'я з обраним гравцем.",
    timing: ANY,
    target: 'other',
  },
  {
    type: SpecialCardType.SWAP_TRAIT,
    category: TraitCategory.BAGGAGE,
    title: 'Обмін багажем',
    description: 'Поміняйтеся багажем з обраним гравцем.',
    timing: ANY,
    target: 'other',
  },
  {
    type: SpecialCardType.SWAP_TRAIT,
    category: TraitCategory.PHOBIA,
    title: 'Обмін фобіями',
    description: 'Передайте свою фобію обраному гравцю й заберіть його.',
    timing: ANY,
    target: 'other',
  },
  {
    type: SpecialCardType.REROLL_OWN,
    category: TraitCategory.HEALTH,
    title: "Нове здоров'я",
    description: "Замініть свою карту здоров'я на випадкову нову.",
    timing: ANY,
    target: 'none',
  },
  {
    type: SpecialCardType.REROLL_OWN,
    category: TraitCategory.BAGGAGE,
    title: 'Знахідка',
    description: 'Замініть свій багаж на випадковий новий.',
    timing: ANY,
    target: 'none',
  },
  {
    type: SpecialCardType.REROLL_OWN,
    category: TraitCategory.PHOBIA,
    title: 'Терапія',
    description: 'Позбудьтеся своєї фобії — отримайте випадкову нову.',
    timing: ANY,
    target: 'none',
  },
  {
    type: SpecialCardType.REROLL_TARGET,
    category: TraitCategory.BAGGAGE,
    title: 'Крадіжка',
    description: 'Багаж обраного гравця зникає — він отримує випадковий новий.',
    timing: ANY,
    target: 'other',
  },
  {
    type: SpecialCardType.REROLL_TARGET,
    category: TraitCategory.HEALTH,
    title: 'Зараження',
    description: "Карта здоров'я обраного гравця замінюється на випадкову.",
    timing: ANY,
    target: 'other',
  },
  {
    type: SpecialCardType.HEAL,
    category: TraitCategory.HEALTH,
    title: 'Аптечка',
    description: 'Повністю вилікуйте будь-якого гравця, зокрема себе.',
    timing: ANY,
    target: 'any',
  },
  {
    type: SpecialCardType.PEEK,
    title: 'Шпигун',
    description: 'Таємно подивіться одну приховану характеристику обраного гравця.',
    timing: ANY,
    target: 'other',
  },
  {
    type: SpecialCardType.FORCE_REVEAL,
    title: 'Викриття',
    description: 'Обраний гравець одразу відкриває всім випадкову приховану характеристику.',
    timing: ANY,
    target: 'other',
  },
  {
    type: SpecialCardType.IMMUNITY,
    title: 'Імунітет',
    description: 'У поточному голосуванні за вас не можна голосувати.',
    timing: VOTING,
    target: 'none',
  },
  {
    type: SpecialCardType.DOUBLE_VOTE,
    title: 'Подвійний голос',
    description: 'У поточному голосуванні ваш голос рахується двічі.',
    timing: VOTING,
    target: 'none',
  },
  {
    type: SpecialCardType.REVOTE,
    title: 'Переголосування',
    description: 'Усі голоси поточного голосування скасовуються, таймер починається спочатку.',
    timing: VOTING,
    target: 'none',
  },
];

/** Health card a HEAL sets. */
export const PERFECT_HEALTH = { label: 'Ідеально здоровий', detail: 'після лікування' };
