// NestJS
import type { Provider } from '@nestjs/common';

// Repositories
import { BLOCK_REQUEST_REPOSITORY } from '../../../domain/repositories/block-request.repository';
import { ENTRY_DENIAL_REPOSITORY } from '../../../domain/repositories/entry-denial.repository';
import { VEHICLE_BLOCK_REPOSITORY } from '../../../domain/repositories/vehicle-block.repository';

// Implementations
import { BlockRequestsTypeormRepository } from '../typeorm/block-requests-typeorm.repository';
import { EntryDenialsTypeormRepository } from '../typeorm/entry-denials-typeorm.repository';
import { VehicleBlocksTypeormRepository } from '../typeorm/vehicle-blocks-typeorm.repository';

/**
 * Providers de DI da feature `blocks` — repositórios e seus Symbol tokens.
 */
export const blocksProviders: Provider[] = [
  VehicleBlocksTypeormRepository,
  {
    provide: VEHICLE_BLOCK_REPOSITORY,
    useExisting: VehicleBlocksTypeormRepository,
  },
  EntryDenialsTypeormRepository,
  {
    provide: ENTRY_DENIAL_REPOSITORY,
    useExisting: EntryDenialsTypeormRepository,
  },
  BlockRequestsTypeormRepository,
  {
    provide: BLOCK_REQUEST_REPOSITORY,
    useExisting: BlockRequestsTypeormRepository,
  },
];
