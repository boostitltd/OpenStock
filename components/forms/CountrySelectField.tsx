/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState } from 'react';
import { Control, Controller, FieldError } from 'react-hook-form';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import countryList from 'react-select-country-list';

const COUNTRY_LABEL_OVERRIDES: Record<string, string> = {
    TW: 'Taiwan',
};

// Country names in Hebrew from the browser's own data; the English list stays as the fallback
const HEBREW_REGIONS = (() => { try { return new Intl.DisplayNames(['he'], { type: 'region' }); } catch { return null; } })();

const COUNTRY_OPTIONS = countryList().getData().map((country) => ({
    ...country,
    label: HEBREW_REGIONS?.of(country.value) ?? COUNTRY_LABEL_OVERRIDES[country.value] ?? country.label,
})).sort((a, b) => (a.value === 'IL' ? -1 : b.value === 'IL' ? 1 : a.label.localeCompare(b.label, 'he')));

type CountrySelectProps = {
    name: string;
    label: string;
    control: Control<any>;
    error?: FieldError;
    required?: boolean;
};

const CountrySelect = ({
                           value,
                           onChange,
                       }: {
    value: string;
    onChange: (value: string) => void;
}) => {
    const [open, setOpen] = useState(false);

    // Helper function to get flag emoji
    const getFlagEmoji = (countryCode: string) => {
        const codePoints = countryCode
            .toUpperCase()
            .split('')
            .map((char) => 127397 + char.charCodeAt(0));
        return String.fromCodePoint(...codePoints);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant='outline'
                    role='combobox'
                    aria-expanded={open}
                    className='country-select-trigger'
                >
                    {value ? (
                        <span className='flex items-center gap-2'>
              <span>{getFlagEmoji(value)}</span>
              <span>{COUNTRY_OPTIONS.find((c) => c.value === value)?.label}</span>
            </span>
                    ) : (
                        'Select your country...'
                    )}
                    <ChevronsUpDown className='ml-2 h-4 w-4 shrink-0 opacity-50' />
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className='w-full p-0 bg-gray-800 border-gray-600'
                align='start'
            >
                <Command className='bg-gray-800 border-gray-600'>
                    <CommandInput
                        placeholder='חיפוש מדינה…'
                        className='country-select-input'
                    />
                    <CommandEmpty className='country-select-empty'>
                        לא נמצאה מדינה.
                    </CommandEmpty>
                    <CommandList className='max-h-60 bg-gray-800 scrollbar-hide-default'>
                        <CommandGroup className='bg-gray-800'>
                            {COUNTRY_OPTIONS.map((country) => (
                                <CommandItem
                                    key={country.value}
                                    value={`${country.label} ${country.value}`}
                                    onSelect={() => {
                                        onChange(country.value);
                                        setOpen(false);
                                    }}
                                    className='country-select-item'
                                >
                                    <Check
                                        className={cn(
                                            'mr-2 h-4 w-4 text-teal-500',
                                            value === country.value ? 'opacity-100' : 'opacity-0'
                                        )}
                                    />
                                    <span className='flex items-center gap-2'>
                    <span>{getFlagEmoji(country.value)}</span>
                    <span>{country.label}</span>
                  </span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
};

export const CountrySelectField = ({
                                       name,
                                       label,
                                       control,
                                       error,
                                       required = false,
                                   }: CountrySelectProps) => {
    return (
        <div className='space-y-2'>
            <Label htmlFor={name} className='form-label'>
                {label}
            </Label>
            <Controller
                name={name}
                control={control}
                rules={{
                    required: required ? `צריך לבחור ${label}` : false,
                }}
                render={({ field }) => (
                    <CountrySelect value={field.value} onChange={field.onChange} />
                )}
            />
            {error && <p className='text-[13px] text-down'>{error.message}</p>}
            <p className='text-[12.5px] text-faint'>
                Helps us show market data and news relevant to you.
            </p>
        </div>
    );
};