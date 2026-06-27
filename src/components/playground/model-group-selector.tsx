import { ChevronsUpDown, Check, CpuIcon } from 'lucide-react'
/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import React, { useState, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/playground/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/playground/ui/command'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/playground/ui/drawer'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/playground/ui/popover'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'

interface ModelOption {
  label: string
  value: string
  category?: string
  description?: string
}

interface ModelSelectorProps {
  selectedModel: string
  models: ModelOption[]
  onModelChange: (value: string) => void
  className?: string
  disabled?: boolean
}

const ModelTriggerButton = React.forwardRef<
  React.ComponentRef<typeof Button>,
  React.ComponentPropsWithoutRef<typeof Button> & {
    currentLabel: string
    triggerClassName?: string
    isDisabled?: boolean
  }
>(({ currentLabel, triggerClassName, isDisabled, ...props }, ref) => (
  <Button
    ref={ref}
    variant='outline'
    role='combobox'
    size='sm'
    disabled={isDisabled}
    className={cn(
      'flex h-8 items-center gap-2 border px-3 font-medium',
      'justify-center p-0 sm:w-auto sm:justify-start sm:px-3',
      'w-8',
      'bg-background text-foreground',
      'hover:bg-accent transition-colors',
      'focus:!ring-0 focus:!outline-none',
      'shadow-none',
      triggerClassName
    )}
    {...props}
  >
    <CpuIcon className='text-muted-foreground block size-4 sm:hidden' />
    <span className='text-muted-foreground sm:text-foreground hidden truncate text-xs sm:block'>
      {currentLabel}
    </span>
    <ChevronsUpDown className='text-muted-foreground hidden h-4 w-4 opacity-50 sm:block' />
  </Button>
))

ModelTriggerButton.displayName = 'ModelTriggerButton'

/**
 * Model Selector Component
 * Styled following Scira's form-component design patterns
 */
export const ModelSelector: React.FC<ModelSelectorProps> = React.memo(
  ({ selectedModel, models, onModelChange, className, disabled = false }) => {
    const { t } = useTranslation()
    const [open, setOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const isMobile = useIsMobile()

    const currentModel = useMemo(
      () => models.find((m) => m.value === selectedModel),
      [models, selectedModel]
    )

    // Group models by category
    const groupedModels = useMemo(
      () =>
        models.reduce(
          (acc, model) => {
            const category = model.category || t('Other')
            if (!acc[category]) {
              acc[category] = []
            }
            acc[category].push(model)
            return acc
          },
          {} as Record<string, ModelOption[]>
        ),
      [models, t]
    )

    // Filter models by search query
    const filteredModels = useMemo(() => {
      if (!searchQuery.trim()) return groupedModels

      const query = searchQuery.toLowerCase()
      const filtered: Record<string, ModelOption[]> = {}

      Object.entries(groupedModels).forEach(([category, categoryModels]) => {
        const matches = categoryModels.filter(
          (m) =>
            m.label.toLowerCase().includes(query) ||
            m.value.toLowerCase().includes(query) ||
            m.description?.toLowerCase().includes(query)
        )
        if (matches.length > 0) {
          filtered[category] = matches
        }
      })

      return filtered
    }, [groupedModels, searchQuery])

    const handleModelChange = useCallback(
      (value: string) => {
        onModelChange(value)
        setOpen(false)
        setSearchQuery('')
      },
      [onModelChange]
    )

    // Shared command content
    const renderModelCommandContent = () => (
      <Command
        className={cn(
          isMobile
            ? 'h-full flex-1 rounded-lg border-0 bg-transparent'
            : 'rounded-lg'
        )}
        filter={() => 1}
        shouldFilter={false}
      >
        {!isMobile && (
          <CommandInput
            placeholder={t('Search models...')}
            className='h-9'
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
        )}
        <CommandEmpty>{t('No model found.')}</CommandEmpty>
        <CommandList
          className={isMobile ? '!max-h-full flex-1 p-2' : 'max-h-[300px]'}
        >
          {Object.keys(filteredModels).length === 0 ? (
            <div className='text-muted-foreground px-3 py-6 text-xs'>
              {t('No model found.')}
            </div>
          ) : (
            Object.entries(filteredModels).map(
              ([category, categoryModels], categoryIndex) => (
                <CommandGroup key={category}>
                  {categoryIndex > 0 && (
                    <div className='border-border my-1 border-t' />
                  )}
                  <div
                    className={cn(
                      'text-muted-foreground px-2 py-1 font-medium',
                      isMobile ? 'text-xs' : 'text-[10px]'
                    )}
                  >
                    {t('{{category}} Models', { category })}
                  </div>
                  {categoryModels.map((model) => (
                    <CommandItem
                      key={model.value}
                      value={model.value}
                      onSelect={handleModelChange}
                      className={cn(
                        'mb-0.5 flex items-center justify-between rounded-lg px-2 py-1.5 text-xs',
                        'transition-all duration-200',
                        'hover:bg-accent',
                        'data-[selected=true]:bg-accent'
                      )}
                    >
                      <div className='flex min-w-0 flex-1 items-center gap-1'>
                        <div
                          className={cn(
                            'truncate font-medium',
                            isMobile ? 'text-sm' : 'text-[11px]'
                          )}
                        >
                          <span className='inline'>{model.label}</span>
                        </div>
                        <Check
                          className={cn(
                            'h-4 w-4 flex-shrink-0',
                            selectedModel === model.value
                              ? 'opacity-100'
                              : 'opacity-0'
                          )}
                        />
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )
            )
          )}
        </CommandList>
      </Command>
    )

    return isMobile ? (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>
          <ModelTriggerButton
            currentLabel={currentModel?.label || t('Model')}
            triggerClassName={className}
            isDisabled={disabled}
            aria-expanded={open}
          />
        </DrawerTrigger>
        <DrawerContent className='flex max-h-[80vh] min-h-[60vh] flex-col'>
          <DrawerHeader className='flex-shrink-0 pb-4'>
            <DrawerTitle className='flex items-center gap-2 text-left text-lg font-medium'>
              {t('Select Model')}
            </DrawerTitle>
          </DrawerHeader>
          <div className='flex min-h-0 flex-1 flex-col'>
            {renderModelCommandContent()}
          </div>
        </DrawerContent>
      </Drawer>
    ) : (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <ModelTriggerButton
              currentLabel={currentModel?.label || t('Model')}
              triggerClassName={className}
              isDisabled={disabled}
              aria-expanded={open}
            />
          }
        />
        <PopoverContent
          className='bg-popover z-40 w-[90vw] max-w-[20em] rounded-lg border p-0 !shadow-none sm:w-[20em]'
          align='start'
          side='bottom'
          sideOffset={4}
          collisionPadding={8}
        >
          {renderModelCommandContent()}
        </PopoverContent>
      </Popover>
    )
  }
)

ModelSelector.displayName = 'ModelSelector'

export interface PlaygroundModelSelectorProps {
  selectedModel: string
  models: ModelOption[]
  onModelChange: (value: string) => void
  className?: string
  disabled?: boolean
}

/**
 * Playground model selector.
 * Uses the new-api playground selector styling without exposing groups.
 */
export const PlaygroundModelSelector: React.FC<PlaygroundModelSelectorProps> = ({
  selectedModel,
  models,
  onModelChange,
  className,
  disabled = false,
}) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const isMobile = useIsMobile()

  const currentModel = useMemo(
    () => models.find((model) => model.value === selectedModel),
    [models, selectedModel]
  )
  const filteredModels = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) {
      return models
    }

    return models.filter((model) => {
      const searchableText = [
        model.label,
        model.value,
        model.description || '',
        model.category || '',
      ]
        .join(' ')
        .toLowerCase()

      return searchableText.includes(query)
    })
  }, [models, searchQuery])

  const handleModelChange = useCallback(
    (value: string) => {
      onModelChange(value)
      setOpen(false)
      setSearchQuery('')
    },
    [onModelChange]
  )

  const renderTrigger = () => (
    <Button
      aria-expanded={open}
      className={cn(
        'h-8 max-w-[15rem] justify-start gap-2 border px-2.5 font-medium shadow-none',
        'bg-background/80 text-black hover:bg-accent/70 hover:text-black disabled:opacity-100',
        'focus:!ring-0 focus:!outline-none',
        className
      )}
      disabled={disabled}
      role='combobox'
      size='sm'
      variant='outline'
    >
      <CpuIcon className='text-muted-foreground size-4 shrink-0' />
      <span className='min-w-0 truncate text-xs text-black'>
        {currentModel?.label || t('Model')}
      </span>
      <ChevronsUpDown className='text-muted-foreground ml-auto size-3.5 shrink-0 opacity-60' />
    </Button>
  )

  const renderModelList = () => (
    <Command
      className='min-w-0 rounded-lg border-0 bg-transparent p-1'
      filter={() => 1}
      shouldFilter={false}
    >
      <CommandInput
        className='h-8 text-[13px]'
        onValueChange={setSearchQuery}
        placeholder={t('Search models...')}
        value={searchQuery}
      />
      <CommandList className={isMobile ? 'max-h-[45vh]' : 'max-h-[24rem]'}>
        {filteredModels.length === 0 ? (
          <div className='text-muted-foreground px-3 py-8 text-center text-[12px] leading-5'>
            {t('No model found.')}
          </div>
        ) : (
          <CommandGroup className='p-1'>
            {filteredModels.map((model) => (
              <CommandItem
                className='mb-0.5 flex items-center justify-between rounded-md px-2 py-1.5 text-[12px] leading-4 transition-colors'
                key={model.value}
                onSelect={handleModelChange}
                value={model.value}
              >
                <span className='min-w-0 truncate font-medium'>
                  {model.label}
                </span>
                <Check
                  className={cn(
                    'size-3.5 shrink-0',
                    selectedModel === model.value ? 'opacity-100' : 'opacity-0'
                  )}
                />
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </Command>
  )

  const renderContent = () => (
    <div className='grid gap-3 p-2'>
      <div className='min-w-0 overflow-hidden rounded-lg border'>
        {renderModelList()}
      </div>
    </div>
  )

  return isMobile ? (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>{renderTrigger()}</DrawerTrigger>
      <DrawerContent className='flex max-h-[80vh] min-h-[60vh] flex-col'>
        <DrawerHeader className='pb-3 text-left'>
          <DrawerTitle>{t('Select Model')}</DrawerTitle>
        </DrawerHeader>
        <div className='min-h-0 flex-1 overflow-y-auto px-4 pb-5'>
          {renderContent()}
        </div>
      </DrawerContent>
    </Drawer>
  ) : (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={renderTrigger()} />
      <PopoverContent
        align='end'
        className='bg-popover z-50 w-[28rem] max-w-[calc(100vw-2rem)] rounded-xl border p-0 shadow-lg'
        collisionPadding={8}
        side='top'
        sideOffset={8}
      >
        {renderContent()}
      </PopoverContent>
    </Popover>
  )
}
