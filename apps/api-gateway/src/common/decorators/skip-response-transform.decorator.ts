import { SetMetadata } from '@nestjs/common';

export const SkipResponseTransform = () =>
  SetMetadata('skipResponseTransform', true);