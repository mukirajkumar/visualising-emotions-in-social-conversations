import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private apiUrl = 'YOUR_PYTHON_API_URL';

  constructor(private http: HttpClient) { }

  sendYoutubeUrl(url: string): Observable<any> {
    const data = { url };
    return this.http.post(this.apiUrl, data);
  }
}
