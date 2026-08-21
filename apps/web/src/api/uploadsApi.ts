import { API_ORIGIN, apiRequest, toUserMessage } from './client'

export async function uploadWorkPhotos(files: File[]): Promise<string[]> {
  const form = new FormData()
  for (const file of files) {
    form.append('files', file)
  }

  try {
    const paths = await apiRequest<string[]>('/uploads/photos', {
      method: 'POST',
      body: form,
    })
    return paths.map((p) =>
      p.startsWith('http') ? p : `${API_ORIGIN}${p.startsWith('/') ? p : `/${p}`}`
    )
  } catch (err) {
    console.error('[uploads]', err)
    throw new Error(toUserMessage(err, 'Не удалось загрузить фото'))
  }
}
