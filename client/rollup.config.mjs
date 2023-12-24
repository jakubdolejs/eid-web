import babel from '@rollup/plugin-babel'
import nodeResolve from '@rollup/plugin-node-resolve'
import typescript from 'rollup-plugin-typescript2'

export default [
    {
        // ES module
        "input": "src/index.ts",
        "output": {
            "file": "es/index.js",
            "format": "es",
            "sourcemap": true
        },
        "plugins": [
            nodeResolve(),
            typescript({
                "tsconfigOverride": {
                    "compilerOptions": {
                        "declaration": false,
                        "sourceMap": true
                    }
                }
            }),
            babel({
                "babelHelpers": "bundled"
            })
        ]
    },{
        // CommonJS module
        "input": "src/index.ts",
        "output": {
            "file": "lib/index.js",
            "format": "cjs",
            "indent": false
        },
        "plugins": [
            nodeResolve(),
            typescript({
                "useTsconfigDeclarationDir": true
            }),
            babel({
                "babelHelpers": "bundled"
            })
        ]
    },{
        // UMD
        "input": "src/index.ts",
        "output": {
            "file": "dist/index.js",
            "format": "umd",
            "name": "VerID",
            "indent": false,
            "sourcemap": true
        },
        plugins: [
            nodeResolve(),
            typescript({
                "tsconfigOverride": {
                    "compilerOptions": {
                        "declaration": false,
                        "sourceMap": true
                    }
                }
            }),
            babel({
                "babelHelpers": "bundled"
            })
        ]
    }
]