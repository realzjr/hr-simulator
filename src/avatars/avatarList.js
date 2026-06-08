/**
 * 头像注册表 — 本地 DiceBear notionists 风格 SVG
 * 按性别分组，用于候选人头像匹配
 */
const AVATAR_FEMALE = [4,8,9,10,13,15,22,23,25,26,28,31].map(n => `avatars/avatar${n}.svg`);
const AVATAR_MALE   = [1,2,3,5,6,7,11,12,14,16,17,18,19,20,21,24,27,29,30,32].map(n => `avatars/avatar${n}.svg`);
const AVATAR_LIST   = [...AVATAR_FEMALE, ...AVATAR_MALE];

const HR_AVATAR_MALE = 'avatars/hr_male.svg';
const HR_AVATAR_FEMALE = 'avatars/hr_female.svg';
