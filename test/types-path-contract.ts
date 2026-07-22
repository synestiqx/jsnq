import type { Path, PathValue } from '../src/synced/core/types';

type Model = {
  user: {
    profile: {
      name: string;
      scores: number[];
    };
  };
};

const top: Path<Model> = 'user';
const nested: Path<Model> = 'user.profile.name';
const arrayDot: Path<Model> = 'user.profile.scores.0';
const arrayBracket: Path<Model> = 'user.profile.scores.[0]';

const name: PathValue<Model, 'user.profile.name'> = 'Ada';
const score: PathValue<Model, 'user.profile.scores.0'> = 42;

void [top, nested, arrayDot, arrayBracket, name, score];

// @ts-expect-error unknown object key
const invalid: Path<Model> = 'user.settings.theme';
void invalid;
