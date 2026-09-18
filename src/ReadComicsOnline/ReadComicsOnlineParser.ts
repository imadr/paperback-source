import {
    Chapter,
    ChapterDetails,
    Tag,
    HomeSection,
    SourceManga,
    PartialSourceManga,
    TagSection,
    HomeSectionType
} from '@paperback/types'

import { decode as decodeHTMLEntity } from 'html-entities'
import { CheerioAPI } from 'cheerio'

export const parseMangaDetails = ($: CheerioAPI, mangaId: string): SourceManga => {
    const title: string = decodeHTMLEntity($('h1.text-2xl').first().text().trim())

    const image: string = $('img.w-full.rounded-xl').first().attr('src') ?? ''

    const author: string = $('div:has(span:contains(Author:)) > a').first().text().trim() ?? ''

    const description: string = decodeHTMLEntity($('h3:contains(Synopsis)').parent().parent().find('p').first().text().trim()) ?? ''

    const arrayTags: Tag[] = []
    for (const tag of $('dl div:contains(Genres:) a').toArray()) {
        const label: string = $(tag).text().trim()
        const id: string = $(tag).attr('href')?.split('/').pop() ?? ''

        if (!id || !label) continue
        arrayTags.push({ id: id, label: label })
    }
    const tagSections: TagSection[] = [App.createTagSection({ id: '0', label: 'genres', tags: arrayTags.map(x => App.createTag(x)) })]

    const rawStatus: string = $('div.flex.flex-wrap.gap-2 span.rounded-full').first().text().trim() ?? ''
    let status = 'Ongoing'
    if (rawStatus.toUpperCase().includes('COMPLETED')) status = 'Completed'

    return App.createSourceManga({
        id: mangaId,
        mangaInfo: App.createMangaInfo({
            titles: [title],
            image: image,
            status: status,
            author: author,
            artist: author,
            tags: tagSections,
            desc: description
        })
    })
}

export const parseChapters = ($: CheerioAPI, mangaId: string): Chapter[] => {
    const chapters: Chapter[] = []
    let sortingIndex = 0

    const chapterListSelector = 'div.overflow-hidden.rounded-xl.border.border-ink-600.bg-ink-900 > a'

    for (const chapter of $(chapterListSelector).toArray()) {
        const title: string = $('span.font-medium', chapter).first().text().trim() ?? ''
        const name: string = $('span.text-brand-400', chapter).first().text().trim() ?? title
        const chapterId: string = $(chapter).attr('href')?.split('/').pop()?.split('?').shift() ?? ''

        if (!chapterId) continue

        const chapMatch = name.match(/#(\d+)/)
        const chapNum = chapMatch ? Number(chapMatch[1]) : 0

        const date: Date = new Date($('span.text-xs.text-slate-500', chapter).last().text().trim())

        if (!chapterId || !name) continue

        chapters.push({
            id: chapterId,
            name: decodeHTMLEntity(name),
            langCode: '🇬🇧',
            chapNum: isNaN(chapNum) ? 0 : chapNum,
            time: date,
            sortingIndex,
            volume: 0,
            group: ''
        })
        sortingIndex--
    }

    if (chapters.length == 0) {
        throw new Error(`Couldn't find any chapters for mangaId: ${mangaId}!`)
    }

    return chapters.map(chapter => {
        chapter.sortingIndex += chapters.length
        return App.createChapter(chapter)
    })
}

export const parseChapterDetails = ($: CheerioAPI, mangaId: string, chapterId: string): ChapterDetails => {
    const pages: string[] = []

    for (const images of $('img', 'div#reader-all').toArray()) {
        const src = $(images).attr('data-src')?.trim() || $(images).attr('src')?.trim()
        if (!src) continue
        pages.push(src)
    }

    const chapterDetails = App.createChapterDetails({
        id: chapterId,
        mangaId: mangaId,
        pages: pages
    })
    return chapterDetails
}

export const parseHomeSections = ($: CheerioAPI, sectionCallback: (section: HomeSection) => void): void => {
    const hotSection = App.createHomeSection({
        id: 'hot_comic', title: 'Hot Comics', containsMoreItems: false,
        type: HomeSectionType.singleRowNormal
    })

    const latestSection = App.createHomeSection({
        id: 'latest_comic', title: 'Latest Comics', containsMoreItems: true,
        type: HomeSectionType.singleRowNormal
    })

    // Hot
    const hotSection_Array: PartialSourceManga[] = []
    for (const comic of $('a.hot-item').toArray()) {
        const image: string = $('img', comic).first().attr('src') ?? ''
        const title: string = $('p.truncate', comic).first().text().trim() ?? ''
        const id: string = $(comic).attr('href')?.split('/').pop()?.split('?').shift() ?? ''
        const subtitle: string = $('p.text-\\[10px\\]', comic).first().text().trim() ?? ''

        if (!id || !title) continue
        hotSection_Array.push(App.createPartialSourceManga({
            mangaId: id,
            image: image,
            title: decodeHTMLEntity(title),
            subtitle: subtitle
        }))
    }

    hotSection.items = hotSection_Array
    sectionCallback(hotSection)

    // Latest
    const latestSection_Array: PartialSourceManga[] = []
    for (const comic of $('div.reveal-card').toArray()) {
        const image: string = $('img.h-28', comic).first().attr('src') ?? ''
        const title: string = $('a.line-clamp-2', comic).first().text().trim() ?? ''
        const id: string = $('a.line-clamp-2', comic).first().attr('href')?.split('/').pop()?.split('?').shift() ?? ''
        const subtitle: string = $('span.rounded.bg-ink-700', comic).first().text().trim() ?? ''

        if (!id || !title) continue
        latestSection_Array.push(App.createPartialSourceManga({
            mangaId: id,
            image: image,
            title: decodeHTMLEntity(title),
            subtitle: subtitle
        }))
    }

    latestSection.items = latestSection_Array
    sectionCallback(latestSection)
}

export const parseViewMore = ($: CheerioAPI): PartialSourceManga[] => {
    const comics: PartialSourceManga[] = []
    const collectedIds: string[] = []

    for (const item of $('div.comic-list-layout .grid > .group').toArray()) {
        const image: string = $('img', item).first().attr('src') ?? ''
        const title: string = $('a.block.text-sm.font-semibold', item).first().text().trim() ?? ''
        const id: string = $('a.block.text-sm.font-semibold', item).first().attr('href')?.split('/').pop()?.split('?').shift() ?? ''
        const subtitle: string = $('a.block.text-xs', item).last().text().trim() ?? ''

        if (!id || !title || collectedIds.includes(id)) continue
        comics.push(App.createPartialSourceManga({
            mangaId: id,
            image: image,
            title: decodeHTMLEntity(title),
            subtitle: subtitle
        }))
        collectedIds.push(id)

    }
    return comics
}

export const parseSearch = ($: CheerioAPI): PartialSourceManga[] => {
    const comics: PartialSourceManga[] = []
    const collectedIds: string[] = []

    for (const item of $('.rc-cover').parent('a.group').toArray()) {
        const image: string = $('img', item).first().attr('src') ?? ''
        const title: string = $('p', item).first().text().trim() ?? ''
        const id: string = $(item).attr('href')?.split('/').pop()?.split('?').shift() ?? ''

        if (!id || !title || collectedIds.includes(id)) continue
        comics.push(App.createPartialSourceManga({
            mangaId: id,
            image: image,
            title: decodeHTMLEntity(title)
        }))

        collectedIds.push(id)
    }

    return comics
}

export const hasNextPage = ($: CheerioAPI): boolean => {
    return $('nav a[rel=next]').length > 0
}
