import { Injectable } from '@angular/core';
import { InstanceFactory } from 'ngforage';

@Injectable({
  providedIn: 'root'
})
export class StorageService {

  static readonly DB_NAME = 'kandinsky';

  constructor(private ngForage: InstanceFactory) { }

  getStorage(name: string): LocalForage {
    return this.ngForage.getInstance({
      name: `__${StorageService.DB_NAME}`,
      storeName: `_${name}`
    });
  }
}
