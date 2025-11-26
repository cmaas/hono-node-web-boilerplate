import { performance } from 'node:perf_hooks';
import { test } from 'node:test';
import { isValidToken } from '../src/util.js';

const SECURE_TOKEN_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz-';

function isValidToken2(token: string): boolean {
	if (!token || typeof token !== 'string') {
		return false;
	}
	if (token.length < 1 || token.length > 256) {
		return false;
	}
	for (const char of token.split('')) {
		if (!SECURE_TOKEN_ALPHABET.includes(char)) {
			return false;
		}
	}
	return true;
}

const validToken = 'Abc123_-Z';
const invalidToken = 'Abc123!@#';
const longToken = 'A'.repeat(256);
// biome-ignore format: keep aligned
const tokens = [
	validToken, invalidToken, longToken, '', 'short', SECURE_TOKEN_ALPHABET,
	'6RyOycCtsoeTh', 'cODb0JOO5L2SV', '8J4BtQAA4Bu9n',
	'bMhTjhSUtZvgA', 'IZOYUtWDoTI7R', 'KAwRCm09LPjbC',
	'Vcf_ye5CIqlTh', 'WRWRHV042NW-J', 'Di8ceQQNXe437',
	'vdGXuyVYNA35g', 'cCahPPKEzKwTO', '-RNggGE_DcHl2',
	'rlt4Behrj86nS', 'wbr6NDJhu7wHQ', 'b57lqbH_Uz2AP',
	'MtYUTMCqCgNbT', 'dZON-lD7OsiWY', 'VjPCyPy7JeV7W',
	'laquKk4oAD8_F', 'WH3S-TKyXsYBH', '0mcerQTNw38qz',
	'Hs4rEVEaGByVA', '3_vpWJLZow6AD', 'I4CLHc-RZMWIX',
	'UcJ7N3JMdEmed', 'LVBF3DX6U3ALu', 'NPP9IdzmizCZ7',
	'ZZ7dZfppBtlvY', 'IARRivA8juOez', 'EUN0Y_1XMTzke',
	'eBIIPwcMecRCm', 'ZPWITuBCcdBQg', 'q1bNVAXJGLX9R',
	'GqBKNpgZSw4Vq', 'qCu3m02LpzOpi', 'Lbx1N7ekgXg58',
	'HiDgVyzeqRkj7', 'AyQ8RB6XWX7sk', 'gRXt9BS0WWMo8',
	'A_BzAA_ysVdIJ', 'aUy-XDDVw_dXy', 'CaewDX4J8mkPp',
	'cqgr1q-5ETMhk', '_xMf8GPQG_nCG', 'OIwpYnOEXPdjm',
	'I_5d-cXFYtjaZ', 'g4Pk2uKUeihN4', 'xlyugH_4DfVX2',
	'JRbWEfYxILcw9', 'oMTG8rNN6XnLa'
];

function runBenchmark(fn: (token: string) => boolean, name: string, iterations = 100_000) {
	const start = performance.now();
	for (let i = 0; i < iterations; i++) {
		for (const token of tokens) {
			fn(token);
		}
	}
	const end = performance.now();
	return { name, ms: end - start };
}

test('Benchmark isValidToken vs isValidToken2', () => {
	const iterations = 100;
	const result1 = runBenchmark(isValidToken, 'isValidToken', iterations);
	const result2 = runBenchmark(isValidToken2, 'isValidToken2', iterations);
	console.log(`\n${result1.name}: ${result1.ms.toFixed(2)} ms for ${iterations} iterations`);
	console.log(`${result2.name}: ${result2.ms.toFixed(2)} ms for ${iterations} iterations`);
});
