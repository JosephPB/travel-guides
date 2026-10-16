import test from 'node:test';
import assert from 'node:assert/strict';
import {usernameEmail} from '../src/login.ts';
test('usernames map consistently to the manually provisioned Auth identity',()=>{
 assert.equal(usernameEmail(' Caragh '),'caragh@never-lonely.example.com');
 assert.equal(usernameEmail('owner_1'),'owner_1@never-lonely.example.com');
});
test('username input cannot select another email domain or create an invalid identity',()=>{
 for(const value of ['', 'caragh@gmail.com', 'two words', '-caragh', 'a'.repeat(41)]) assert.throws(()=>usernameEmail(value));
});
