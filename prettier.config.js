module.exports = {
    semi: false,
    singleQuote: true,
    printWidth: 100,
    tabWidth: 4,
    useTabs: false,
    trailingComma: 'es5',
    bracketSpacing: true,
    endOfLine: 'auto',
    plugins: ['prettier-plugin-tailwindcss', '@trivago/prettier-plugin-sort-imports'],
    importOrder: ['^@core/(.*)$', '^@server/(.*)$', '^@ui/(.*)$', '^[./]'],
    importOrderSeparation: true,
    importOrderSortSpecifiers: true,
}
