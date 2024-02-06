import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private apiUrl = 'http://127.0.0.1:5000/api/youtube_sentiment';

  constructor(private http: HttpClient) { }

  sendYoutubeUrl(url: string): Observable<any> {
    const data = { url };
    return this.http.post(this.apiUrl, data);
  }
}
