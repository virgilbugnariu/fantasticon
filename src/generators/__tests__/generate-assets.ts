import { FontAssetType, OtherAssetType, AssetType } from '../../types/misc';
import { RunnerOptions } from '../../types/runner';
import { AssetsMap } from '../../utils/assets';
import { generateAssets } from '../generate-assets';
import { getCodepoints } from '../../utils/codepoints';
import { getGeneratorOptions } from '../generator-options';
import generators from '../asset-types';

const getCodepointsMock = (getCodepoints as any) as jest.Mock;

jest.mock('../../utils/codepoints', () => ({
  getCodepoints: jest.fn(() => ({ __mock: 'codepoint__' }))
}));

jest.mock('../asset-types', () => {
  const mockResult = (type: string) => `::${type}::`;
  const mockGenerator = (name: string, dependsOn: string | null = null) => ({
    dependsOn,
    generate: jest.fn(async (_, dependant) => {
      if (dependsOn && dependant !== mockResult(dependsOn)) {
        throw new Error(
          `'${name}' generator called without '${dependsOn}' result`
        );
      }

      return mockResult(name);
    })
  });

  return {
    a: mockGenerator('a'),
    b: mockGenerator('b', 'a'),
    c: mockGenerator('c', 'd'),
    d: mockGenerator('d')
  };
});

const cast = <T>(val: any) => (val as unknown) as T;

const getGeneratorFn = (key: string) =>
  generators[key as keyof typeof generators].generate;

describe('Generate assets', () => {
  beforeEach(() => {
    for (const gen of Object.values(generators)) {
      ((gen.generate as unknown) as jest.Mock).mockClear();
    }

    getCodepointsMock.mockClear();
  });

  test('`generateAssets` correctly generates and returns assets specified by the merged `fontTypes` and `assetTypes` option', async () => {
    const fontTypes = cast<FontAssetType[]>(['a']);
    const assetTypes = cast<OtherAssetType[]>(['c']);
    const assets = cast<AssetsMap>({ __mock: 'assetsMap__' });
    const result = await generateAssets(
      assets,
      cast<RunnerOptions>({ fontTypes, assetTypes })
    );

    expect(result).toEqual({ a: '::a::', c: '::c::' });
  });

  test('`generateAssets` calls necessary generator functions with correct argugments and only once, and with correctly generated codepoints', async () => {
    const fontTypes = cast<AssetType[]>(['b', 'd']);
    const assets = cast<AssetsMap>({ __mock: 'assetsMap__' });
    const codepointsIn = { __mock: '::codepoint-in::' };
    const codepointsOut = { __mock: '::codepoint-out::' };
    const options = cast<RunnerOptions>({
      fontTypes,
      assetTypes: [],
      codepoints: codepointsIn
    });
    const genOptions = {
      ...getGeneratorOptions(options, assets),
      codepoints: codepointsOut
    };

    getCodepointsMock.mockImplementationOnce(() => codepointsOut);

    await generateAssets(assets, options);

    expect(getCodepointsMock).toHaveBeenCalledTimes(1);
    expect(getCodepointsMock).toHaveBeenCalledWith(assets, codepointsIn);

    expect(getGeneratorFn('a')).toHaveBeenCalledTimes(1);
    expect(getGeneratorFn('a')).toHaveBeenCalledWith(genOptions, null);

    expect(getGeneratorFn('b')).toHaveBeenCalledTimes(1);
    expect(getGeneratorFn('b')).toHaveBeenCalledWith(genOptions, '::a::');

    expect(getGeneratorFn('c')).not.toHaveBeenCalled();

    expect(getGeneratorFn('d')).toHaveBeenCalledTimes(1);
    expect(getGeneratorFn('d')).toHaveBeenCalledWith(genOptions, null);
  });
});
