export type NewSessionModelOption = {
    value: string
    label: string
}

export function selectNewSessionModel(args: {
    currentModel: string
    preferredModel: string | null
    modelOptions: NewSessionModelOption[]
}): string {
    if (args.preferredModel && args.modelOptions.some((option) => option.value === args.preferredModel)) {
        return args.preferredModel
    }
    return args.modelOptions[0]?.value ?? args.currentModel
}
